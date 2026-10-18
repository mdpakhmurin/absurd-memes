// Автоматическое расположение текста: ищем «спокойную» зону картинки
// (мало деталей и не слишком светло, чтобы белый текст читался).
import { measureBlock, blockRect } from './render.js';

const MARGIN = 0.05;

export function analyzeImage(img) {
  const w = 64;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const h = Math.max(8, Math.round((w * ih) / iw));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // картинка без CORS, анализ недоступен
  }
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }
  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      grad[i] = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]);
    }
  }
  return { w, h, lum, grad };
}

function regionScore(an, r, W, H) {
  if (!an) return 0;
  const x0 = Math.max(0, Math.floor((r.x / W) * an.w));
  const x1 = Math.min(an.w - 1, Math.ceil(((r.x + r.w) / W) * an.w));
  const y0 = Math.max(0, Math.floor((r.y / H) * an.h));
  const y1 = Math.min(an.h - 1, Math.ceil(((r.y + r.h) / H) * an.h));
  let g = 0, l = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * an.w + x;
      g += an.grad[i];
      l += an.lum[i];
      n++;
    }
  }
  if (!n) return 1;
  const edges = g / n / 0.15;
  const bright = Math.max(0, l / n - 0.6) * 1.5;
  return edges + bright;
}

const SINGLE = [
  { id: 'bottom', align: 'center', x: 0.5, v: 'bottom', bias: -0.06 },
  { id: 'top', align: 'center', x: 0.5, v: 'top', bias: 0 },
  { id: 'left-bottom', align: 'left', x: 0.07, v: 'bottom', bias: -0.02 },
  { id: 'left-middle', align: 'left', x: 0.07, v: 'middle', bias: 0.02 },
  { id: 'left-top', align: 'left', x: 0.07, v: 'top', bias: 0.02 },
  { id: 'center', align: 'center', x: 0.5, v: 'middle', bias: 0.08 },
];

const ALLOWED = {
  auto: null,
  both: null,
  top: ['top', 'left-top'],
  bottom: ['bottom', 'left-bottom'],
  center: ['center'],
};

function yFor(v, hFrac) {
  if (v === 'top') return MARGIN + hFrac / 2;
  if (v === 'bottom') return 1 - MARGIN - hFrac / 2;
  return 0.5;
}

/** Ставит блоки друг под другом, начиная от зоны v. */
function stack(ctx, texts, W, H, sizeFrac, v) {
  const gap = 0.025;
  const blocks = texts.map((text) => ({ text, align: 'center', x: 0.5, y: 0 }));
  const hs = blocks.map((b) => measureBlock(ctx, b, W, H, sizeFrac).height / H);
  const total = hs.reduce((a, b) => a + b, 0) + gap * (hs.length - 1);
  let top = v === 'top' ? MARGIN : v === 'bottom' ? 1 - MARGIN - total : 0.5 - total / 2;
  blocks.forEach((b, i) => {
    b.y = top + hs[i] / 2;
    top += hs[i] + gap;
  });
  return blocks;
}

/**
 * @param texts строки текста (1 = одна надпись, 2+ = диалог)
 * @param pos auto | top | bottom | both | center
 */
export function autoLayout(ctx, an, texts, W, H, sizeFrac, pos = 'auto') {
  if (texts.length >= 2) {
    if (pos === 'top' || pos === 'bottom' || pos === 'center') return stack(ctx, texts, W, H, sizeFrac, pos);
    // auto / both: первая реплика сверху, остальные снизу
    const [first, ...rest] = texts;
    return [...stack(ctx, [first], W, H, sizeFrac, 'top'), ...stack(ctx, rest, W, H, sizeFrac, 'bottom')];
  }

  const allowed = ALLOWED[pos];
  const cands = SINGLE.filter((c) => !allowed || allowed.includes(c.id));
  let best = null;
  for (const c of cands) {
    const block = { text: texts[0] ?? '', align: c.align, x: c.x, y: 0.5 };
    const m = measureBlock(ctx, block, W, H, sizeFrac);
    block.y = yFor(c.v, m.height / H);
    const r = blockRect(block, m, W, H);
    const pad = m.px * 0.3;
    const score = regionScore(an, { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }, W, H)
      + c.bias + Math.random() * 0.05;
    if (!best || score < best.score) best = { score, block };
  }
  return [best.block];
}

// Рисует мем на canvas: картинка + белый текст с мягкой тёмной обводкой.
export const FONT_FAMILY = '"Noto Sans", "Golos Text", system-ui, sans-serif';
const WEIGHT = 600;
const LINE_HEIGHT = 1.1;

const BASE_SIZE = { word: 0.15, phrase: 0.11, dialog: 0.1 };
const MAX_WIDTH = { center: 0.9, left: 0.62 };

export const fontSizeFrac = (mode, scale = 1) => (BASE_SIZE[mode] ?? 0.1) * scale;

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

/** Подбирает размер шрифта и переносы под ширину. Всё в пикселях. */
export function measureBlock(ctx, block, W, H, sizeFrac) {
  const maxW = W * (MAX_WIDTH[block.align] ?? 0.9);
  let px = Math.max(12, Math.round(sizeFrac * Math.min(H, W * 0.75)));
  let lines;
  for (let i = 0; i < 14; i++) {
    ctx.font = `${WEIGHT} ${px}px ${FONT_FAMILY}`;
    lines = wrap(ctx, block.text, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if ((widest <= maxW && lines.length <= 4) || px <= 14) break;
    px = Math.round(px * 0.9);
  }
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const lineH = px * LINE_HEIGHT;
  return { lines, px, lineH, width, height: lineH * lines.length };
}

export function blockRect(block, m, W, H) {
  const cx = block.x * W;
  const x = block.align === 'left' ? cx : cx - m.width / 2;
  const y = block.y * H - m.height / 2;
  return { x, y, w: m.width, h: m.height };
}

/**
 * @returns {Array<{x:number,y:number,w:number,h:number}>} прямоугольники блоков в пикселях
 */
export function drawMeme(ctx, { img, blocks, sizeFrac }) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);

  const rects = [];
  for (const block of blocks) {
    if (!block.text?.trim()) {
      rects.push(null);
      continue;
    }
    const m = measureBlock(ctx, block, W, H, sizeFrac);
    const r = blockRect(block, m, W, H);
    rects.push(r);

    ctx.font = `${WEIGHT} ${m.px}px ${FONT_FAMILY}`;
    ctx.textAlign = block.align === 'left' ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const tx = block.x * W;

    m.lines.forEach((line, i) => {
      const ty = r.y + m.lineH * (i + 0.5);
      // Мягкая тень + тонкая полупрозрачная обводка, как в оригинальных мемах.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = m.px * 0.18;
      ctx.lineWidth = Math.max(2, m.px * 0.07);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeText(line, tx, ty);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.fillText(line, tx, ty);
    });
  }
  return rects;
}

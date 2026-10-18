// Параметры мема в адресной строке. Это наш «API» на GitHub Pages:
// ?mode=phrase&text=Колбасы&img=1084&size=1200x800&pos=bottom&mat=1&fs=1.2
const MODES = ['word', 'phrase', 'dialog'];
const POSITIONS = ['auto', 'top', 'bottom', 'both', 'center'];

export function readParams(search = location.search) {
  const q = new URLSearchParams(search);
  const out = {};
  if (MODES.includes(q.get('mode'))) out.mode = q.get('mode');
  if (q.has('text')) {
    const lines = q.get('text').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (lines.length) out.text = lines;
  }
  if (/^\d+$/.test(q.get('img') || '')) out.img = q.get('img');
  if (/^\d+x\d+$/.test(q.get('size') || '')) out.size = q.get('size');
  if (POSITIONS.includes(q.get('pos'))) out.pos = q.get('pos');
  if (q.has('mat')) out.mat = q.get('mat') === '1';
  const fs = parseFloat(q.get('fs'));
  if (fs >= 0.4 && fs <= 2.5) out.fontScale = fs;
  // Ручные позиции блоков: p=c,0.5,0.9;l,0.07,0.8
  if (q.get('p')) {
    const pts = q.get('p').split(';').map((s) => {
      const [a, x, y] = s.split(',');
      return { align: a === 'l' ? 'left' : 'center', x: +x, y: +y };
    });
    if (pts.every((p) => isFinite(p.x) && isFinite(p.y))) out.points = pts;
  }
  if (q.get('view') === 'clean') out.clean = true;
  return out;
}

export function buildParams(state) {
  const q = new URLSearchParams();
  q.set('mode', state.mode);
  if (state.texts.length) q.set('text', state.texts.join('|'));
  if (state.image && !state.image.custom) {
    q.set('img', state.image.id);
    q.set('size', state.image.size);
  }
  if (state.pos !== 'auto') q.set('pos', state.pos);
  if (state.mat) q.set('mat', '1');
  if (state.fontScale !== 1) q.set('fs', String(state.fontScale));
  if (state.manual) {
    q.set('p', state.blocks.map((b) => `${b.align === 'left' ? 'l' : 'c'},${b.x.toFixed(3)},${b.y.toFixed(3)}`).join(';'));
  }
  return q;
}

export function writeUrl(state) {
  const qs = buildParams(state).toString();
  history.replaceState(null, '', `${location.pathname}?${qs}`);
}

export function shareUrl(state) {
  return `${location.origin}${location.pathname}?${buildParams(state).toString()}`;
}

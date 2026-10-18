// Перетаскивание надписей пальцем или мышью прямо на картинке.

function toCanvasPoint(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  };
}

function hitIndex(rects, p, pad) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (r && p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad) return i;
  }
  return -1;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{getRects: () => any[], onMove: (i:number, dx:number, dy:number) => void, onEnd: () => void, onTap: (i:number) => void}} h
 */
export function attachDrag(canvas, { getRects, onMove, onEnd, onTap }) {
  let drag = null;
  const pad = () => canvas.width * 0.02;

  // Блокируем прокрутку страницы только когда палец попал на надпись.
  canvas.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (t && hitIndex(getRects(), toCanvasPoint(canvas, t), pad()) >= 0) e.preventDefault();
    },
    { passive: false },
  );

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvasPoint(canvas, e);
    const idx = hitIndex(getRects(), p, pad());
    if (idx < 0) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { idx, last: p, start: p, moved: false };
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvasPoint(canvas, e);
    if (!drag) {
      canvas.style.cursor = hitIndex(getRects(), p, pad()) >= 0 ? 'grab' : '';
      return;
    }
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > canvas.width * 0.006) drag.moved = true;
    if (drag.moved) onMove(drag.idx, (p.x - drag.last.x) / canvas.width, (p.y - drag.last.y) / canvas.height);
    drag.last = p;
  });

  const finish = () => {
    if (!drag) return;
    const { idx, moved } = drag;
    drag = null;
    canvas.classList.remove('dragging');
    moved ? onEnd() : onTap(idx);
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}

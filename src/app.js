import { randomImage, loadImage } from './sources/images.js';
import { randomPhrase } from './sources/phrases.js';
import { randomWord } from './sources/words.js';
import { autoLayout, analyzeImage } from './layout.js';
import { drawMeme, fontSizeFrac, FONT_FAMILY } from './render.js';
import { attachDrag } from './editor.js';
import { readParams, writeUrl, shareUrl } from './params.js';
import { copyImage, downloadImage, shareImage, copyText, canShare } from './share.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

const state = {
  mode: 'phrase', // word | phrase | dialog
  mat: false,
  pos: 'auto',
  fontScale: 1,
  image: null, // { el, w, h, id, size, author, custom }
  texts: [],
  source: null, // { source, sourceUrl }
  blocks: [], // { text, x, y, align } в долях картинки
  manual: false,
};
let analysis = null;
let rects = [];
let genId = 0;

const sizeFrac = () => fontSizeFrac(state.mode, state.fontScale);
const textCount = () => (state.mode === 'dialog' ? 2 : 1);

/* ---------- рисование ---------- */

function relayout() {
  if (!state.image) return;
  state.blocks = autoLayout(ctx, analysis, state.texts, canvas.width, canvas.height, sizeFrac(), state.pos);
  state.manual = false;
}

function draw() {
  if (!state.image) return;
  rects = drawMeme(ctx, { img: state.image.el, blocks: state.blocks, sizeFrac: sizeFrac() });
  writeUrl(state);
  renderCredits();
}

function setImage(image) {
  state.image = image;
  canvas.width = image.w;
  canvas.height = image.h;
  analysis = analyzeImage(image.el);
  $('#frame').style.aspectRatio = `${image.w} / ${image.h}`;
}

/* ---------- генерация ---------- */

async function fetchText() {
  return state.mode === 'word' ? randomWord() : randomPhrase({ mode: state.mode, mat: state.mat });
}

async function fetchImage(opts) {
  const im = await randomImage(opts);
  return { el: im.img, w: im.img.naturalWidth, h: im.img.naturalHeight, id: im.id, size: im.size, author: im.author, custom: false };
}

async function generate({ img = true, text = true } = {}) {
  const my = ++genId;
  setBusy(true);
  try {
    const [image, phrase] = await Promise.all([img ? fetchImage() : null, text ? fetchText() : null]);
    if (my !== genId) return; // пользователь уже нажал ещё раз
    if (image) setImage(image);
    if (phrase) {
      state.texts = phrase.lines;
      state.source = phrase;
      renderFields();
    }
    if (text || !state.manual) relayout();
    draw();
  } catch (e) {
    toast(e.message);
  } finally {
    if (my === genId) setBusy(false);
  }
}

async function useCustomImage(file) {
  if (!file?.type.startsWith('image/')) return;
  setBusy(true);
  try {
    const url = URL.createObjectURL(file);
    const raw = await loadImage(url, false);
    // Фото с телефона бывают огромными: ужимаем до 1600 px по длинной стороне.
    const scale = Math.min(1, 1600 / Math.max(raw.naturalWidth, raw.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(raw.naturalWidth * scale);
    c.height = Math.round(raw.naturalHeight * scale);
    c.getContext('2d').drawImage(raw, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    setImage({ el: c, w: c.width, h: c.height, custom: true });
    relayout();
    draw();
    toast('Своя картинка на месте. В ссылку она не попадёт, только текст.');
  } catch (e) {
    toast(e.message);
  } finally {
    setBusy(false);
  }
}

/* ---------- интерфейс ---------- */

function setBusy(on) {
  document.body.classList.toggle('busy', on);
  $('#btnNext').disabled = on;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function renderFields() {
  const box = $('#textFields');
  box.innerHTML = '';
  for (let i = 0; i < textCount(); i++) {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.textContent = textCount() > 1 ? (i === 0 ? 'Первая реплика' : 'Вторая реплика') : 'Текст';
    const ta = document.createElement('textarea');
    ta.rows = 1;
    ta.value = state.texts[i] ?? '';
    ta.dataset.index = i;
    ta.addEventListener('input', () => {
      state.texts[i] = ta.value;
      state.source = null;
      if (state.manual && state.blocks.length === state.texts.length) state.blocks[i].text = ta.value;
      else relayout();
      draw();
    });
    label.append(span, ta);
    box.append(label);
  }
}

function renderCredits() {
  const box = $('#credits');
  box.innerHTML = '';
  const add = (label, text, href) => {
    const p = document.createElement('p');
    p.append(label + ' ');
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = text;
      p.append(a);
    } else p.append(text);
    box.append(p);
  };
  const im = state.image;
  if (im?.custom) add('Фото:', 'твоё');
  else if (im) add('Фото:', im.author ? `${im.author}, Picsum` : 'Picsum', `https://picsum.photos/id/${im.id}/info`);
  if (state.source?.source) add('Текст:', state.source.source, state.source.sourceUrl);
}

function syncControls() {
  document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
  $('#mat').checked = state.mat;
  $('#pos').value = state.pos;
  $('#fs').value = state.fontScale;
}

/* ---------- события ---------- */

$('#btnNext').addEventListener('click', () => generate());
$('#btnImg').addEventListener('click', () => generate({ text: false }));
$('#btnText').addEventListener('click', () => generate({ img: false }));

document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => {
    state.mode = r.value;
    generate({ img: false });
  }),
);

$('#mat').addEventListener('change', (e) => {
  state.mat = e.target.checked;
  if (state.mode !== 'word') generate({ img: false });
  else writeUrl(state);
});

$('#pos').addEventListener('change', (e) => {
  state.pos = e.target.value;
  relayout();
  draw();
});

$('#fs').addEventListener('input', (e) => {
  state.fontScale = +e.target.value;
  if (!state.manual) relayout();
  draw();
});

$('#btnResetPos').addEventListener('click', () => {
  relayout();
  draw();
});

$('#file').addEventListener('change', (e) => {
  useCustomImage(e.target.files[0]);
  e.target.value = '';
});

$('#btnCopy').addEventListener('click', async () => {
  try {
    await copyImage(canvas);
    toast('Мем скопирован');
  } catch (e) {
    toast(e.message || 'Не удалось скопировать. Нажми «Скачать».');
  }
});
$('#btnDownload').addEventListener('click', () => downloadImage(canvas).catch((e) => toast(e.message)));
$('#btnLink').addEventListener('click', async () => {
  try {
    await copyText(shareUrl(state));
    toast(state.image?.custom ? 'Ссылка скопирована, но без твоей картинки' : 'Ссылка скопирована');
  } catch {
    toast('Не удалось скопировать ссылку');
  }
});
if (canShare()) {
  $('#btnShare').hidden = false;
  $('#btnShare').addEventListener('click', () =>
    shareImage(canvas, shareUrl(state)).catch((e) => e.name !== 'AbortError' && toast(e.message)),
  );
}

// Вставка из буфера: картинка заменяет фото, текст заменяет надпись.
document.addEventListener('paste', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const items = [...(e.clipboardData?.items || [])];
  const imgItem = items.find((i) => i.type.startsWith('image/'));
  if (imgItem) {
    e.preventDefault();
    useCustomImage(imgItem.getAsFile());
    return;
  }
  const text = e.clipboardData?.getData('text/plain')?.trim();
  if (text) {
    e.preventDefault();
    state.texts = text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, textCount());
    state.source = null;
    renderFields();
    relayout();
    draw();
  }
});

// Перетаскивание файла на страницу.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  useCustomImage(e.dataTransfer?.files?.[0]);
});

// Пробел: новый мем (когда фокус не в поле ввода).
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.target.closest('input, textarea, select, button, summary')) {
    e.preventDefault();
    generate();
  }
});

attachDrag(canvas, {
  getRects: () => rects,
  onMove: (i, dx, dy) => {
    const b = state.blocks[i];
    b.x = Math.min(1, Math.max(0, b.x + dx));
    b.y = Math.min(1, Math.max(0, b.y + dy));
    state.manual = true;
    rects = drawMeme(ctx, { img: state.image.el, blocks: state.blocks, sizeFrac: sizeFrac() });
  },
  onEnd: () => writeUrl(state),
  onTap: (i) => {
    $('#editor').open = true;
    $(`#textFields textarea[data-index="${i}"]`)?.focus();
  },
});

/* ---------- старт ---------- */

async function init() {
  const p = readParams();
  if (p.clean) document.body.classList.add('clean');
  if (p.mode) state.mode = p.mode;
  else if (p.text?.length >= 2) state.mode = 'dialog';
  if (p.mat !== undefined) state.mat = p.mat;
  if (p.pos) state.pos = p.pos;
  if (p.fontScale) state.fontScale = p.fontScale;
  syncControls();

  setBusy(true);
  const fontReady = document.fonts?.load(`600 64px ${FONT_FAMILY}`, 'Абв').catch(() => {});
  try {
    const [image, phrase] = await Promise.all([
      fetchImage({ id: p.img, size: p.size }),
      p.text ? { lines: p.text, source: null } : fetchText(),
      fontReady,
    ]);
    setImage(image);
    state.texts = phrase.lines;
    state.source = phrase;
    renderFields();
    if (p.points?.length === state.texts.length) {
      state.blocks = p.points.map((pt, i) => ({ ...pt, text: state.texts[i] }));
      state.manual = true;
    } else relayout();
    draw();
  } catch (e) {
    toast(e.message);
  } finally {
    setBusy(false);
  }
}

init();

// Достаёт реплики из HTML страницы Викицитатника.
// Возвращает блоки: каждый блок это массив строк (2+ строк = диалог).

const SKIP_SECTION = /источник|ссылк|примечан|см\.? также|о фильме|о сериале|о мультфильме|цитаты о|литератур|в ролях|актёр|создател|интересн/i;
const JUNK = /https?:|www\.|википеди|©|\bрежисс|\bсценари|\bсерия\b|\bсезон\b|\d{4}/i;

export function cleanLine(raw) {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' '); // ремарки и сноски
  s = s.replace(/^[\s—–\-−•*:]+/, '');
  // «Данила: текст» -> «текст»
  const m = s.match(/^([А-ЯЁA-Z][^:]{0,28}):\s+(.+)$/);
  if (m && m[1].split(' ').length <= 3) s = m[2];
  s = s.replace(/^[\s—–\-−]+/, '');
  s = s.replace(/^[«"„]+|[»"“]+$/g, '');
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.!?…])/g, '$1').trim();
  return s;
}

function blockLines(el) {
  const clone = el.cloneNode(true);
  // Вложенные списки внутри цитаты обычно содержат пояснения и авторов.
  clone.querySelectorAll('ul, ol, dl').forEach((n) => n.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return clone.textContent
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);
}

export function extractBlocks(doc) {
  const root = doc.querySelector('.mw-parser-output') || doc.body;
  if (!root) return [];
  root
    .querySelectorAll('sup, .reference, .mw-editsection, table, .navbox, .metadata, style, script, figure, .thumb, .noprint, .mw-empty-elt')
    .forEach((n) => n.remove());

  const blocks = [];
  let skipping = false;

  const visit = (el) => {
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    const isHeading = /^h[2-6]$/.test(tag) || el.classList?.contains('mw-heading');
    if (isHeading) {
      skipping = SKIP_SECTION.test(el.textContent);
      return;
    }
    if (skipping) return;
    if (tag === 'ul' || tag === 'ol') {
      for (const li of el.children) if (li.tagName.toLowerCase() === 'li') push(blockLines(li));
    } else if (tag === 'dl') {
      // Подряд идущие dd часто составляют один диалог.
      const lines = [];
      for (const c of el.children) if (/^d[dt]$/i.test(c.tagName)) lines.push(...blockLines(c));
      push(lines);
    } else if (tag === 'p' || tag === 'blockquote') {
      push(blockLines(el));
    } else if (tag === 'div' || tag === 'section') {
      for (const c of el.children) visit(c);
    }
  };
  const push = (lines) => {
    if (lines.length) blocks.push(lines);
  };

  for (const c of root.children) visit(c);
  return blocks;
}

export function isGoodLine(s, maxChars = 60) {
  if (!s || s.length < 2 || s.length > maxChars) return false;
  if (JUNK.test(s)) return false;
  if (!/[а-яё]/i.test(s)) return false;
  const words = s.split(' ').length;
  return words <= 10;
}

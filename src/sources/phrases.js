// Фразы из фильмов, мультфильмов и сериалов Викицитатника.
import { rand, wikiApi } from '../util.js';
import { hasMat, hasSlur } from '../filters.js';
import { extractBlocks, isGoodLine } from './quoteParser.js';
import { PHRASES, DIALOGS } from './fallback.js';

const HOST = 'ru.wikiquote.org';
const ROOTS = ['Категория:Фильмы', 'Категория:Мультфильмы', 'Категория:Телесериалы'];
const LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЧШЭЯ';

// Запасной список узнаваемых фильмов, если обход категорий ничего не дал.
const KNOWN = [
  'Брат (фильм)', 'Брат 2', 'Жмурки', 'ДМБ (фильм)', 'Бумер', 'Особенности национальной охоты',
  'Особенности национальной рыбалки', 'День выборов', 'День радио', 'О чём говорят мужчины',
  'Кин-дза-дза!', 'Джентльмены удачи', 'Операция «Ы» и другие приключения Шурика',
  'Бриллиантовая рука', 'Иван Васильевич меняет профессию', 'Афоня', 'Любовь и голуби',
  'Гараж (фильм)', 'Ирония судьбы, или С лёгким паром!', 'Служебный роман', 'Самогонщики',
  'Ну, погоди!', 'Простоквашино', 'Карты, деньги, два ствола', 'Большой куш',
];

const membersCache = new Map();

async function members(cat) {
  const letter = Math.random() < 0.7 ? rand([...LETTERS]) : '';
  const key = cat + '|' + letter;
  if (!membersCache.has(key)) {
    const params = {
      action: 'query', list: 'categorymembers', cmtitle: cat,
      cmnamespace: '0|14', cmlimit: '200',
    };
    if (letter) params.cmstartsortkeyprefix = letter;
    const data = await wikiApi(HOST, params);
    let list = data.query?.categorymembers || [];
    if (!list.length && letter) return members(cat); // буква пустая, пробуем без неё
    membersCache.set(key, list);
  }
  return membersCache.get(key);
}

async function randomTitle() {
  if (Math.random() < 0.35) return rand(KNOWN);
  let cat = rand(ROOTS);
  for (let depth = 0; depth < 5; depth++) {
    const list = await members(cat);
    const pages = list.filter((m) => m.ns === 0);
    const cats = list.filter((m) => m.ns === 14);
    if (pages.length && (!cats.length || Math.random() < 0.6)) return rand(pages).title;
    if (!cats.length) break;
    cat = rand(cats).title;
  }
  return rand(KNOWN);
}

async function pageBlocks(title) {
  const data = await wikiApi(HOST, {
    action: 'parse', page: title, prop: 'text', redirects: '1',
    disableeditsection: '1', disabletoc: '1',
  });
  const html = data.parse?.text || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return { title: data.parse?.title || title, blocks: extractBlocks(doc) };
}

function pickFrom(candidates, mat) {
  const allowed = candidates.filter((c) => !c.some(hasSlur) && (mat || !c.some(hasMat)));
  if (!allowed.length) return null;
  if (mat) {
    const spicy = allowed.filter((c) => c.some(hasMat));
    if (spicy.length && Math.random() < 0.7) return rand(spicy);
  }
  return rand(allowed);
}

function candidatesFor(blocks, mode) {
  const out = [];
  for (const b of blocks) {
    if (mode === 'dialog') {
      for (let i = 0; i + 1 < b.length; i++) {
        if (isGoodLine(b[i], 50) && isGoodLine(b[i + 1], 50)) out.push([b[i], b[i + 1]]);
      }
    } else {
      for (const line of b) if (isGoodLine(line, 60)) out.push([line]);
    }
  }
  return out;
}

/**
 * @param {{mode: 'phrase'|'dialog', mat: boolean}} opts
 * @returns {Promise<{lines: string[], source: string}>}
 */
export async function randomPhrase({ mode = 'phrase', mat = false } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { title, blocks } = await pageBlocks(await randomTitle());
      const pick = pickFrom(candidatesFor(blocks, mode), mat);
      if (pick) return { lines: pick, source: title, sourceUrl: `https://${HOST}/wiki/${encodeURIComponent(title)}` };
    } catch (e) {
      console.warn('[phrases]', e);
    }
  }
  return fallbackPhrase({ mode, mat });
}

export function fallbackPhrase({ mode, mat }) {
  const pool = mode === 'dialog' ? DIALOGS : PHRASES;
  const list = mat && Math.random() < 0.7 ? pool.mat : pool.clean;
  const pick = rand(list);
  return { lines: Array.isArray(pick) ? pick : [pick], source: null };
}

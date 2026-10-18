// Случайные фото с Picsum. Без ключа, с CORS, поэтому canvas можно экспортировать.
import { rand, randInt, fetchJson } from '../util.js';

export const SIZES = ['1260x840', '1200x800', '1280x800', '1200x900', '1080x1080', '1200x750'];

let idsCache = null;

async function randomId() {
  try {
    if (!idsCache) {
      const page = randInt(1, 10);
      const list = await fetchJson(`https://picsum.photos/v2/list?page=${page}&limit=100`);
      idsCache = list.map((x) => ({ id: x.id, author: x.author }));
    }
    const pick = idsCache.splice(randInt(0, idsCache.length - 1), 1)[0];
    if (!idsCache.length) idsCache = null;
    return pick;
  } catch {
    return { id: String(randInt(0, 1084)), author: null };
  }
}

export function loadImage(src, crossOrigin = true) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Картинка не загрузилась'));
    img.src = src;
  });
}

/**
 * @param {{id?: string, size?: string}} opts
 * @returns {Promise<{img: HTMLImageElement, id: string, size: string, author: string|null}>}
 */
export async function randomImage({ id, size } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const pick = id ? { id, author: null } : await randomId();
    const sz = SIZES.includes(size) ? size : rand(SIZES);
    const [w, h] = sz.split('x');
    try {
      const img = await loadImage(`https://picsum.photos/id/${pick.id}/${w}/${h}`);
      return { img, id: pick.id, size: sz, author: pick.author };
    } catch (e) {
      console.warn('[images]', e);
      id = undefined; // заданный id сломан, берём случайный
    }
  }
  throw new Error('Не удалось загрузить картинку. Проверь интернет и нажми «Ещё мем».');
}

// Случайные фото с Wikimedia Commons (категория «Quality images»).
// Commons и upload.wikimedia.org открываются в России и отдают CORS,
// поэтому canvas можно копировать и скачивать. Picsum остался запасным.
import { rand, randInt, wikiApi } from '../util.js';

const HOST = 'commons.wikimedia.org';
const CATEGORY = 'Category:Quality_images';
const THUMB_WIDTH = 1280; // стандартная ширина превью Wikimedia
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVW';
const SECOND = 'AEIOURLNST';

let pool = [];

const stripHtml = (s) => (s ? new DOMParser().parseFromString(s, 'text/html').body.textContent.trim() : null);

function toImageInfo(page) {
  const ii = page.imageinfo?.[0];
  if (!ii || !/jpe?g/i.test(ii.mime || '')) return null;
  const ratio = ii.width / ii.height;
  if (ratio < 0.75 || ratio > 2.1 || ii.width < 900) return null;
  const author = stripHtml(ii.extmetadata?.Artist?.value);
  return {
    id: page.title.replace(/^File:/, ''),
    src: ii.thumburl || ii.url,
    page: ii.descriptionurl,
    author: author && author.length < 60 ? author : null,
  };
}

const IMAGEINFO = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: String(THUMB_WIDTH),
  iiextmetadatafilter: 'Artist',
};

async function fillPool() {
  const prefix = rand([...LETTERS]) + rand([...SECOND]);
  const data = await wikiApi(HOST, {
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: CATEGORY,
    gcmtype: 'file',
    gcmlimit: '50',
    gcmstartsortkeyprefix: prefix,
    ...IMAGEINFO,
  });
  pool = (data.query?.pages || []).map(toImageInfo).filter(Boolean);
}

async function byTitle(id) {
  const data = await wikiApi(HOST, { action: 'query', titles: `File:${id}`, ...IMAGEINFO });
  return toImageInfo(data.query?.pages?.[0] || {});
}

async function pickCommons(id) {
  if (id) {
    const info = await byTitle(id);
    if (info) return info;
  }
  for (let i = 0; i < 3 && !pool.length; i++) await fillPool();
  if (!pool.length) throw new Error('Commons не ответил');
  return pool.splice(randInt(0, pool.length - 1), 1)[0];
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

async function fromPicsum() {
  const id = String(randInt(0, 1084));
  const img = await loadImage(`https://picsum.photos/id/${id}/1260/840`);
  return { img, id: null, author: 'Picsum', page: `https://picsum.photos/id/${id}/info` };
}

/**
 * @param {{id?: string}} opts id это имя файла на Commons
 * @returns {Promise<{img: HTMLImageElement, id: string|null, author: string|null, page: string}>}
 */
export async function randomImage({ id } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const info = await pickCommons(attempt === 0 ? id : undefined);
      const img = await loadImage(info.src);
      return { img, id: info.id, author: info.author, page: info.page };
    } catch (e) {
      console.warn('[images]', e);
    }
  }
  try {
    return await fromPicsum();
  } catch {
    throw new Error('Не удалось загрузить картинку. Проверь интернет и нажми «Ещё мем».');
  }
}

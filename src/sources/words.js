// Одно случайное слово: Викисловарь, русские существительные.
import { rand, capitalize, wikiApi } from '../util.js';
import { hasSlur } from '../filters.js';
import { WORDS } from './fallback.js';

const HOST = 'ru.wiktionary.org';
const CAT = 'Категория:Русские существительные';
const FIRST = 'абвгдежзиклмнопрстуфхшя';
const SECOND = 'аеиоулнрст';

const isWord = (t) => /^[а-яё]{3,14}$/.test(t) && !hasSlur(t);

async function fromWiktionary() {
  const prefix = rand([...FIRST]) + rand([...SECOND]);
  const data = await wikiApi(HOST, {
    action: 'query', list: 'categorymembers', cmtitle: CAT,
    cmnamespace: '0', cmlimit: '100', cmstartsortkeyprefix: prefix,
  });
  const words = (data.query?.categorymembers || []).map((m) => m.title).filter(isWord);
  return words.length ? rand(words) : null;
}

/** @returns {Promise<{lines: string[], source: string|null}>} */
export async function randomWord() {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const w = await fromWiktionary();
      if (w) return { lines: [capitalize(w)], source: 'Викисловарь', sourceUrl: `https://${HOST}/wiki/${encodeURIComponent(w)}` };
    } catch (e) {
      console.warn('[words]', e);
    }
  }
  return { lines: [rand(WORDS)], source: null };
}

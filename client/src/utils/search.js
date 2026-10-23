// রেপার্টরি সার্চ: হুবহু লেখা না মিললেও কাণ্ড-শব্দ মিলিয়ে খোঁজে
// (হজম ↔ হজমের, মিষ্টি ↔ মিষ্টিতে, cough ↔ coughing)।

import {
  EN_STOP,
  BN_STOP,
  normalize,
  wordsOf,
  charLen,
  isAsciiWord,
  minStemLen,
  stemHit,
} from './textMatch.js';

const EXACT_SCORE = 10;
const STEM_SCORE = 6;
const INSIDE_SCORE = 3;
const PHRASE_BONUS = 12;
// নিজের যোগ করা এন্ট্রি একই মানের সিডেড এন্ট্রির উপরে রাখি
const CUSTOM_BONUS = 5;

// সার্চে ছোট বাংলা শব্দও দরকার ("পা", "কান"), তাই বাংলায় ২ অক্ষর থেকে নিই
function isSearchToken(t) {
  if (/^\d+$/.test(t)) return true;
  if (isAsciiWord(t)) return t.length >= 3 && !EN_STOP.has(t);
  return charLen(t) >= 2 && !BN_STOP.has(t);
}

// পুরো কোয়েরি যদি শুধু ভরাট-শব্দ হয়, তখন সেগুলোই খুঁজি
export function queryTokens(query) {
  const raw = [...new Set(wordsOf(query))];
  const meaningful = raw.filter(isSearchToken);
  return meaningful.length ? meaningful : raw;
}

function matchToken(wordSet, words, token) {
  if (wordSet.has(token)) return { score: EXACT_SCORE, word: token };
  if (charLen(token) < minStemLen(token)) return null;
  const near = stemHit(words, token);
  if (near) return { score: STEM_SCORE, word: near };
  // "বদহজম"-এর ভেতরে "হজম" — যৌগশব্দের ভেতরের মিলও ধরিই, তবে কম গুরুত্বে
  const inside = words.find((w) => w.includes(token));
  return inside ? { score: INSIDE_SCORE, word: inside } : null;
}

// প্রতিটি শব্দ মিললে তবেই ফলাফল; একটাও না মিললে আংশিক ফলাফল ফেরায় (partial=true)
export function searchRubrics(rubrics, query) {
  const list = rubrics ?? [];
  const q = String(query ?? '').trim();
  if (!q) {
    return { items: list.map((rubric) => ({ rubric, score: 0, matchedWords: [] })), partial: false, tokens: [] };
  }

  const tokens = queryTokens(q);
  const phrase = normalize(q);
  const scored = list
    .map((rubric) => {
      const text = normalize(rubric.rubric_text);
      const words = wordsOf(rubric.rubric_text);
      const wordSet = new Set(words);
      let score = 0;
      let missing = 0;
      const matchedWords = new Set();

      for (const token of tokens) {
        const hit = matchToken(wordSet, words, token);
        if (!hit) { missing++; continue; }
        score += hit.score;
        matchedWords.add(hit.word);
      }

      // পুরো লেখাটা এক শব্দবন্ধ হিসেবে পাশাপাশি থাকলে অতিরিক্ত গুরুত্ব
      if (phrase.includes(' ') && ` ${text} `.includes(` ${phrase} `)) {
        score += PHRASE_BONUS;
        matchedWords.add(phrase);
      }
      if (rubric.is_custom) score += CUSTOM_BONUS;

      return { rubric, score, missing, matchedWords: [...matchedWords] };
    })
    .filter((s) => s.matchedWords.length > 0);

  const full = scored.filter((s) => s.missing === 0);
  const partial = full.length === 0 && scored.length > 0;
  const items = (partial ? scored : full).sort(
    (a, b) =>
      b.score - a.score ||
      a.missing - b.missing ||
      a.rubric.section.localeCompare(b.rubric.section) ||
      a.rubric.rubric_text.localeCompare(b.rubric.rubric_text)
  );

  return { items, partial, tokens };
}

const REMEDY_FIELDS = [
  ['name', 10],
  ['source', 6],
  ['clinical', 4],
  ['keynotes', 4],
  ['better', 3],
  ['worse', 3],
];

// ওষুধ-পিকারের সার্চ: নাম, উৎস, ক্লিনিক্যাল, কী-নোট, ভালো/বাড়ে — সবই মেলে
export function searchRemedies(remedies, query) {
  const list = remedies ?? [];
  const q = String(query ?? '').trim();
  if (!q) {
    return { items: list.map((remedy) => ({ remedy, score: 0, matchedWords: [] })), partial: false, tokens: [] };
  }

  const tokens = queryTokens(q);
  const phrase = normalize(q);
  const scored = list
    .map((remedy) => {
      const fields = REMEDY_FIELDS.map(([key, weight]) => {
        const words = wordsOf(remedy?.[key]);
        return { key, weight, text: words.join(' '), words, wordSet: new Set(words) };
      });
      const haystack = fields.map((f) => f.text).join(' ');
      const matchedWords = new Set();
      let score = 0;
      let missing = 0;

      for (const token of tokens) {
        let best = null;
        for (const field of fields) {
          if (!field.words.length) continue;
          const hit = matchToken(field.wordSet, field.words, token);
          let word = hit?.word;
          let value = hit ? field.weight + hit.score : 0;
          // নামের ক্ষেত্রে ৩ অক্ষরের ইংরেজি শুরুও ধরিই ("nat" → Natrum)
          if (!hit && field.key === 'name' && charLen(token) === 3 && isAsciiWord(token)) {
            const near = field.words.find((w) => w.startsWith(token));
            if (near) { word = near; value = field.weight + STEM_SCORE; }
          }
          if (!word) continue;
          if (!best || value > best.value) best = { value, word };
        }
        if (!best) { missing++; continue; }
        score += best.value;
        matchedWords.add(best.word);
      }

      if (phrase.includes(' ') && ` ${haystack} `.includes(` ${phrase} `)) {
        score += PHRASE_BONUS;
        matchedWords.add(phrase);
      }
      if (remedy.is_custom) score += CUSTOM_BONUS;

      return { remedy, score, missing, matchedWords: [...matchedWords] };
    })
    .filter((s) => s.matchedWords.length > 0);

  const full = scored.filter((s) => s.missing === 0);
  const partial = full.length === 0 && scored.length > 0;
  const items = (partial ? scored : full).sort(
    (a, b) =>
      b.score - a.score ||
      a.missing - b.missing ||
      a.remedy.name.localeCompare(b.remedy.name)
  );

  return { items, partial, tokens };
}

// মিলে যাওয়া শব্দগুলো কোথায় কোথায় আছে — হাইলাইট করার জন্য ভাগ করে দেয়
export function highlightSegments(text, words = []) {
  const source = String(text ?? '');
  if (!words.length) return [{ text: source, hit: false }];

  const hay = source.toLowerCase();
  const ranges = [];
  for (const word of words) {
    const needle = String(word).toLowerCase();
    if (!needle) continue;
    let from = 0;
    while (from <= hay.length - needle.length) {
      const at = hay.indexOf(needle, from);
      if (at === -1) break;
      ranges.push([at, at + needle.length]);
      from = at + needle.length;
    }
  }
  if (!ranges.length) return [{ text: source, hit: false }];

  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const parts = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: source.slice(cursor, start), hit: false });
    parts.push({ text: source.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < source.length) parts.push({ text: source.slice(cursor), hit: false });
  return parts;
}

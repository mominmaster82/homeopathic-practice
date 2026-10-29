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
  nearHit,
  isNearWord,
  bengaliSkeleton,
} from './textMatch.js';

const EXACT_SCORE = 10;
const SKELETON_SCORE = 7;
const STEM_SCORE = 6;
const INSIDE_SCORE = 3;
const FUZZY_SCORE = 2;
const PHRASE_BONUS = 12;
const BIGRAM_BONUS = 8;
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

const skeletonCache = new Map();
function skeletonOf(word) {
  const key = String(word);
  let value = skeletonCache.get(key);
  if (value === undefined) {
    value = bengaliSkeleton(key);
    skeletonCache.set(key, value);
  }
  return value;
}

function matchToken(wordSet, words, token, { fuzzy = true } = {}) {
  if (wordSet.has(token)) return { score: EXACT_SCORE, word: token };
  if (charLen(token) < minStemLen(token)) return null;
  const near = stemHit(words, token);
  if (near) return { score: STEM_SCORE, word: near };
  // "ব্যাথা" ↔ "ব্যথা" — কার-চিহ্ন আলাদা হলেও একই ব্যঞ্জন-কাঠামো
  const skel = bengaliSkeleton(token);
  if (skel !== token && charLen(skel) >= 2) {
    for (const word of words) {
      const wordSkel = skeletonOf(word);
      if (wordSkel === skel || (charLen(skel) >= 3 && wordSkel.includes(skel))) {
        return { score: SKELETON_SCORE, word };
      }
    }
  }
  // "বদহজম"-এর ভেতরে "হজম" — যৌগশব্দের ভেতরের মিলও ধরিই, তবে কম গুরুত্বে
  const inside = words.find((w) => w.includes(token));
  if (inside) return { score: INSIDE_SCORE, word: inside };
  // বানান সামান্য ভুল হলেও (এক অক্ষর) কাছাকাছি শব্দটি ধরিই
  const fuzzyWord = fuzzy ? nearHit(words, token) : null;
  return fuzzyWord ? { score: FUZZY_SCORE, word: fuzzyWord } : null;
}

// রুব্রিকের নরমালাইজড শব্দ একবারই হিসাব করি — প্রতি কিস্ট্রোকে ৬০০+ রুব্রিক আবার স্ক্যান হয়
const rubricDocCache = new WeakMap();
function rubricDoc(rubric) {
  if (!rubric || typeof rubric !== 'object') {
    return { text: '', words: [], wordSet: new Set() };
  }
  let doc = rubricDocCache.get(rubric);
  if (!doc) {
    const words = [...new Set(wordsOf(rubric.rubric_text))];
    doc = { text: normalize(rubric.rubric_text), words, wordSet: new Set(words) };
    rubricDocCache.set(rubric, doc);
  }
  return doc;
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
      const { text, words, wordSet } = rubricDoc(rubric);
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

      const matchedCount = tokens.length - missing;
      const coverage = tokens.length ? matchedCount / tokens.length : 1;
      return { rubric, score, missing, matchedCount, coverage, matchedWords: [...matchedWords] };
    })
    .filter((s) => s.matchedWords.length > 0);

  const full = scored.filter((s) => s.missing === 0);
  // আংশিক ফলের ক্ষেত্রে ৩+ শব্দে অন্তত দুটি মিললেই দেখাই; দুই শব্দের কোয়েরিতে একটি মিলও রাখি
  const minPartial = tokens.length <= 2 ? 1 : 2;
  const partialItems = scored.filter((s) => s.matchedCount >= minPartial);
  const partial = full.length === 0 && partialItems.length > 0;
  const items = (partial ? partialItems : full).sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.score - a.score ||
      a.missing - b.missing ||
      a.rubric.section.localeCompare(b.rubric.section) ||
      a.rubric.rubric_text.localeCompare(b.rubric.rubric_text)
  );

  return { items, partial, tokens };
}

const REMEDY_FIELDS = [
  ['name', 9],
  ['source', 5],
  ['keynotes', 5],
  ['clinical', 5],
  ['better', 2],
  ['worse', 2],
];

const FIELD_LABELS = {
  name: 'নাম',
  source: 'উৎস',
  keynotes: 'কী-নোট',
  clinical: 'ক্লিনিক্যাল ব্যবহার',
  better: 'কীতে ভালো',
  worse: 'কীতে বাড়ে',
};

const CORE_FIELDS = new Set(['keynotes', 'clinical']);

// প্রতি কিস্ট্রোকে ওষুধের টেক্সট আবার নরমালাইজ না করতে ক্যাশ রাখি
const remedyDocCache = new WeakMap();

function remedyDoc(remedy) {
  if (!remedy || typeof remedy !== 'object') return [];
  const cached = remedyDocCache.get(remedy);
  if (cached) return cached;

  const doc = REMEDY_FIELDS.map(([key, weight]) => {
    const raw = String(remedy?.[key] ?? '');
    const words = [...new Set(wordsOf(raw))];
    return { key, weight, raw, text: words.join(' '), words, wordSet: new Set(words) };
  });
  doc.haystack = doc.map((f) => f.text).join(' ');
  remedyDocCache.set(remedy, doc);
  return doc;
}

// শব্দ → ওষুধ/ফিল্ডের উল্টো-তালিকা। ১৮০টি ওষুধে প্রতি কিস্ট্রোকে সব টেক্সট স্ক্যান না করে
// কেবল মিলে যাওয়া শব্দগুলোর ওষুধেই স্কোর করি — গদ্য সার্চও দ্রুত থাকে।
const remedyIndexCache = new WeakMap();

function remedyIndex(list) {
  let index = remedyIndexCache.get(list);
  if (index) return index;

  // word → [{ remedy, key, weight }] (ফ্ল্যাট তালিকা — নেস্টেড Map-এর চেয়ে দ্রুত তৈরি হয়)
  const byWord = new Map();
  for (const remedy of list) {
    for (const field of remedyDoc(remedy)) {
      for (const word of field.words) {
        let entries = byWord.get(word);
        if (!entries) { entries = []; byWord.set(word, entries); }
        entries.push({ remedy, key: field.key, weight: field.weight });
      }
    }
  }
  const vocab = [...byWord.keys()];
  const bySkeleton = new Map();
  for (const word of vocab) {
    if (!/[^\x00-\x7F]/.test(word)) continue;
    const skel = bengaliSkeleton(word);
    if (skel === word || charLen(skel) < 2) continue;
    let bucket = bySkeleton.get(skel);
    if (!bucket) { bucket = []; bySkeleton.set(skel, bucket); }
    bucket.push(word);
  }
  index = { byWord, vocab, wordSet: new Set(vocab), bySkeleton };
  remedyIndexCache.set(list, index);
  return index;
}

// একটি কোয়েরি-শব্দ ভোকাবুলারির কোন কোন শব্দের সাথে মেলে (হুবহু → কাণ্ড → যৌগ → বানান-ভুল)
function tokenWordHits(index, token) {
  const hits = [];
  const seen = new Set();
  const push = (word, score) => {
    if (seen.has(word)) return;
    seen.add(word);
    hits.push({ word, score });
  };

  if (index.wordSet.has(token)) push(token, EXACT_SCORE);

  if (charLen(token) >= minStemLen(token)) {
    for (const word of index.vocab) {
      if (word === token || charLen(word) < minStemLen(word)) continue;
      if (word.startsWith(token) || token.startsWith(word)) push(word, STEM_SCORE);
    }
  }

  // কার-চিহ্ন বদলালেও একই ব্যঞ্জন-কাঠামো (ফুলে ↔ ফোলা, ব্যাথা ↔ মাথাব্যথা)
  const skel = bengaliSkeleton(token);
  if (skel !== token && charLen(skel) >= 2) {
    const bucket = index.bySkeleton.get(skel);
    if (bucket) {
      for (const word of bucket) push(word, SKELETON_SCORE);
    } else if (charLen(skel) >= 3) {
      for (const [key, words] of index.bySkeleton) {
        if (!key.includes(skel)) continue;
        for (const word of words) push(word, SKELETON_SCORE);
      }
    }
  }
  if (hits.length) return hits;

  for (const word of index.vocab) {
    if (word.includes(token)) push(word, INSIDE_SCORE);
  }
  if (hits.length) return hits;

  if (charLen(token) >= 4) {
    for (const word of index.vocab) {
      if (word[0] !== token[0] || Math.abs(word.length - token.length) > 3) continue;
      if (isNearWord(word, token)) push(word, FUZZY_SCORE);
    }
  }
  return hits;
}

// সব ওষুধের স্কোর একসাথে — প্রতি শব্দের সেরা ফিল্ড/ওজন ধরে
function scoreRemediesByIndex(list, tokens, phrase) {
  const index = remedyIndex(list);
  const aggregates = new Map();
  const total = list.length || 1;

  // পাশাপাশি লেখা শব্দবন্ধ ("মিষ্টি খেলে") হুবহু থাকলে অতিরিক্ত গুরুত্ব
  const seq = phrase.split(' ').filter(Boolean);
  const bigrams = [];
  for (let i = 0; i < seq.length - 1; i++) {
    if (isSearchToken(seq[i]) && isSearchToken(seq[i + 1])) bigrams.push(`${seq[i]} ${seq[i + 1]}`);
  }

  for (const token of tokens) {
    const hits = tokenWordHits(index, token);
    if (!hits.length) continue;

    // বিরল শব্দ বেশি গুরুত্বপূর্ণ ("ফুলে" > "গেছে"), তাই ওষুধ-সংখ্যার উল্টো ওজন (IDF)
    const tokenRemedies = new Set();
    for (const hit of hits) {
      const entries = index.byWord.get(hit.word);
      if (entries) for (const entry of entries) tokenRemedies.add(entry.remedy);
    }
    const idf = 1 + Math.log10(total / Math.max(1, tokenRemedies.size));

    // এই শব্দের জন্য প্রতি ওষুধের সেরা মিল
    const tokenBest = new Map();
    for (const hit of hits) {
      const entries = index.byWord.get(hit.word);
      if (!entries) continue;
      for (const entry of entries) {
        const value = (entry.weight + hit.score) * idf;
        const prev = tokenBest.get(entry.remedy);
        if (!prev || value > prev.value) tokenBest.set(entry.remedy, { value, word: hit.word, key: entry.key });
      }
    }

    for (const [remedy, best] of tokenBest) {
      let agg = aggregates.get(remedy);
      if (!agg) {
        agg = {
          remedy,
          score: 0,
          matchedTokens: 0,
          coreHits: 0,
          matchedWords: new Set(),
          fieldScores: {},
        };
        aggregates.set(remedy, agg);
      }
      agg.score += best.value;
      agg.matchedTokens++;
      if (CORE_FIELDS.has(best.key)) agg.coreHits++;
      agg.matchedWords.add(best.word);
      agg.fieldScores[best.key] = (agg.fieldScores[best.key] || 0) + best.value;
    }
  }

  for (const agg of aggregates.values()) {
    const fields = remedyDoc(agg.remedy);
    const haystack = ` ${fields.haystack} `;
    if (phrase.includes(' ') && haystack.includes(` ${phrase} `)) {
      agg.score += PHRASE_BONUS;
      agg.matchedWords.add(phrase);
    }
    for (const bigram of bigrams) {
      if (!haystack.includes(` ${bigram} `)) continue;
      agg.score += BIGRAM_BONUS;
      agg.matchedWords.add(bigram);
    }
    if (agg.remedy.is_custom) agg.score += CUSTOM_BONUS;

    agg.missing = tokens.length - agg.matchedTokens;
    agg.coverage = tokens.length ? agg.matchedTokens / tokens.length : 1;

    // কী-নোট/ক্লিনিক্যালে মিলকে স্নিপেটে অগ্রাধিকার দিই
    let primaryField = 'name';
    let primaryValue = -1;
    for (const [key, value] of Object.entries(agg.fieldScores)) {
      const weighted = value + (CORE_FIELDS.has(key) ? 3 : 0);
      if (weighted > primaryValue) { primaryValue = weighted; primaryField = key; }
    }
    agg.primaryField = primaryField;
    agg.matchedWords = [...agg.matchedWords];
  }

  return [...aggregates.values()];
}

function makeSnippet(remedy, fieldKey, words) {
  const field = remedyDoc(remedy).find((f) => f.key === fieldKey);
  const source = String(field?.raw ?? '').replace(/\s+/g, ' ').trim();
  if (!source) return '';

  const hay = source.toLowerCase();
  let at = -1;
  let width = 0;
  for (const word of words) {
    const needle = String(word).toLowerCase();
    if (!needle) continue;
    const found = hay.indexOf(needle);
    if (found !== -1 && (at === -1 || found < at)) { at = found; width = needle.length; }
  }
  if (at === -1) return source.length > 150 ? `${source.slice(0, 150)}…` : source;

  const start = Math.max(0, at - 45);
  const end = Math.min(source.length, at + width + 85);
  return `${start > 0 ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`;
}

// ওষুধ-পিকারের সার্চ: নাম, উৎস, ক্লিনিক্যাল, কী-নোট, ভালো/বাড়ে — সবই মেলে
export function searchRemedies(remedies, query) {
  const list = remedies ?? [];
  const q = String(query ?? '').trim();
  if (!q) {
    return { items: list.map((remedy) => ({ remedy, score: 0, matchedWords: [] })), partial: false, tokens: [] };
  }

  const tokens = queryTokens(q);
  const phrase = normalize(q);
  const scored = scoreRemediesByIndex(list, tokens, phrase);

  const full = scored.filter((s) => s.missing === 0);
  const partial = full.length === 0 && scored.length > 0;
  const items = (partial ? scored : full).sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.score - a.score ||
      a.missing - b.missing ||
      a.remedy.name.localeCompare(b.remedy.name)
  );

  return { items, partial, tokens };
}

// রেপার্টরি সার্চের ওষুধ-প্রস্তাব: গদ্য লিখলেও যতগুলো শব্দ মিলেছে তার অনুপাতে সাজায়
export function searchRemediesProse(remedies, query, { limit = 6 } = {}) {
  const list = remedies ?? [];
  const q = String(query ?? '').trim();
  if (!q) return [];

  const tokens = queryTokens(q);
  if (!tokens.length) return [];
  const phrase = normalize(q);
  const scored = scoreRemediesByIndex(list, tokens, phrase);
  if (!scored.length) return [];

  // বড় গদ্যে সব শব্দ না মিললেও কাছাকাছি ওষুধ দেখাই; এক-দুই শব্দে একটি মিলই যথেষ্ট
  const minHits = tokens.length <= 2 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.34));
  const relevant = scored.filter(
    (s) => s.matchedTokens >= minHits || (tokens.length >= 4 && s.coreHits >= 2)
  );
  const pool = relevant.length ? relevant : scored.filter((s) => s.coreHits > 0);
  if (!pool.length) return [];

  return pool
    .map((s) => ({ ...s, rank: s.score * (0.45 + 0.55 * s.coverage) + s.coverage * 8 }))
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.coverage - a.coverage ||
        b.score - a.score ||
        a.remedy.name.localeCompare(b.remedy.name)
    )
    .slice(0, limit)
    .map((s) => ({
      remedy: s.remedy,
      score: Math.round(s.rank * 10) / 10,
      coverage: s.coverage,
      matchedWords: s.matchedWords,
      field: s.primaryField,
      fieldLabel: FIELD_LABELS[s.primaryField] || '',
      snippet: makeSnippet(s.remedy, s.primaryField, s.matchedWords),
      matchedTokens: s.matchedTokens,
      totalTokens: tokens.length,
    }));
}

// প্রথম কিস্ট্রোকেই যেন খোঁজা দেরি না হয় — অলস সময়ে ইনডেক্স/ক্যাশ আগেই তৈরি করি
export function warmSearchIndexes(rubrics, remedies) {
  if (Array.isArray(rubrics)) for (const rubric of rubrics) rubricDoc(rubric);
  if (Array.isArray(remedies) && remedies.length) remedyIndex(remedies);
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

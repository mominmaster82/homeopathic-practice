// ওষুধের কী-নোট/ক্লিনিক্যাল টেক্সটের সাথে রুব্রিকের টেক্সট মিলিয়ে
// লিংকের প্রস্তাব তৈরি করে। প্রস্তাবগুলো কেবল সূত্র — ব্যবহারকারী যাচাই করে যোগ করবেন।

const EN_STOP = new Set([
  'with', 'from', 'that', 'this', 'these', 'those', 'have', 'has', 'had', 'into', 'upon',
  'when', 'where', 'which', 'while', 'after', 'before', 'during', 'other', 'also', 'very',
  'more', 'most', 'some', 'such', 'than', 'then', 'there', 'their', 'them', 'they', 'will',
  'would', 'could', 'should', 'about', 'been', 'being', 'both', 'each', 'over', 'under',
  'again', 'against', 'between', 'through', 'because', 'only', 'same', 'just', 'like',
  'worse', 'better', 'amelioration', 'aggravation', 'symptom', 'symptoms',
]);

const BN_STOP = new Set([
  'এবং', 'বা', 'ও', 'এর', 'এই', 'সেই', 'যে', 'যা', 'করে', 'হয়', 'হয়ে', 'হলে', 'হতে',
  'থেকে', 'জন্য', 'সাথে', 'মধ্যে', 'উপর', 'নিচে', 'পরে', 'আগে', 'খুব', 'কম', 'বেশি', 'বেশ',
  'একটি', 'একটা', 'কিছু', 'সব', 'না', 'নেই', 'আছে', 'মতো', 'দিকে', 'ধরনের', 'অনেক',
  'তার', 'তাঁর', 'আমার', 'আপনার', 'একই', 'কিন্তু', 'তাই', 'সালে', 'দিন', 'সময়', 'রোগী',
  'বাড়ে', 'বেড়ে', 'ভালো', 'কমে', 'শুরু', 'থাকে', 'লাগে', 'মনে', 'হলো', 'ওঠে', 'আসে',
  'যায়', 'দেয়',
]);

// এই স্কোরের নিচে মিল হলে প্রস্তাব দেখানো হয় না
const MIN_SCORE = 2;

// "Tonsillitis (টনসিলিটিস)" → ['Tonsillitis', 'টনসিলিটিস']
export function splitRubricPhrases(text) {
  const raw = String(text ?? '').trim();
  const m = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const parts = m ? [m[1].trim(), m[2].trim()] : [raw];
  return parts.filter(Boolean);
}

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[।,;:.!?()[\]{}"'“”‘’/\\|@#$%^&*+=~`<>_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const wordsOf = (text) => normalize(text).split(' ').filter(Boolean);

const charLen = (t) => [...t].length;

// মিল খোঁজার সময় সাধারণ/অর্থহীন শব্দ বাদ দিই
function interestingWords(text) {
  return [...new Set(wordsOf(text))].filter((t) => {
    if (/^\d+$/.test(t)) return false;
    if (/^[a-z]+$/.test(t)) return t.length >= 4 && !EN_STOP.has(t);
    return charLen(t) >= 3 && !BN_STOP.has(t);
  });
}

const REMEDY_FIELDS = [
  ['clinical', 'ক্লিনিক্যাল ব্যবহার', 6],
  ['keynotes', 'কী-নোট', 5],
  ['better', 'কীতে ভালো', 4],
  ['worse', 'কীতে বাড়ে', 4],
  ['name', 'নাম', 4],
  ['source', 'উৎস', 4],
];

function remedyDoc(remedy) {
  return REMEDY_FIELDS.map(([key, label, weight]) => {
    const value = remedy?.[key];
    return {
      label,
      weight,
      text: normalize(value),
      words: new Set(wordsOf(value)),
    };
  });
}

// "টনসিল" ↔ "টনসিলিটিস" / "cough" ↔ "coughs" — কাণ্ড-শব্দ মিলিয়ে দেখি
function stemHit(words, token) {
  if (charLen(token) < 4) return null;
  for (const word of words) {
    if (charLen(word) < 4) continue;
    if (word === token || word.startsWith(token) || token.startsWith(word)) return word;
  }
  return null;
}

function matchPhrases(phrases, doc) {
  const unique = [];
  const seen = new Set();
  for (const p of phrases) {
    const norm = normalize(p);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    unique.push({ raw: p, norm, multi: norm.includes(' ') });
  }

  let score = 0;
  const reasons = [];

  // পুরো শব্দবন্ধ/শব্দ হুবহু কোনো ফিল্ডে থাকলে — সবচেয়ে নির্ভরযোগ্য মিল
  for (const phrase of unique) {
    for (const field of doc) {
      if (!field.text) continue;
      if (phrase.multi) {
        if (!` ${field.text} `.includes(` ${phrase.norm} `)) continue;
        score += field.weight;
        reasons.push(`${field.label}-এ “${phrase.raw}” আছে`);
      } else if (field.words.has(phrase.norm)) {
        score += field.weight;
        reasons.push(`${field.label}-এ “${phrase.raw}” আছে`);
      } else {
        const near = stemHit(field.words, phrase.norm);
        if (!near) continue;
        score += field.weight * 0.75;
        reasons.push(`${field.label}-এ “${near}” কাছাকাছি শব্দ আছে`);
      }
    }
  }

  // বাকি শব্দগুলোর আংশিক মিল (বানান/বাক্য গঠন হুবহু না মিললেও)
  const tokenHits = [];
  const seenWords = new Set();
  for (const phrase of unique) {
    for (const word of interestingWords(phrase.raw)) {
      if (seenWords.has(word)) continue;
      const field = doc.find((f) => f.words.has(word));
      if (!field) continue;
      seenWords.add(word);
      tokenHits.push({ word, label: field.label });
      score += 1;
    }
  }
  if (tokenHits.length >= 2) {
    const sample = tokenHits.slice(0, 3).map((t) => t.word).join(', ');
    reasons.push(`${tokenHits[0].label}-এ শব্দ মিলেছে: ${sample}`);
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 3) };
}

// নির্বাচিত ওষুধের বিপরীতে সব রুব্রিকের প্রস্তাব
export function suggestRubricsForRemedy(remedy, rubrics, { limit = 20, excludeIds = [] } = {}) {
  const doc = remedyDoc(remedy);
  const exclude = new Set(excludeIds.map(Number));
  return rubrics
    .filter((r) => !exclude.has(Number(r.id)))
    .map((rubric) => {
      const { score, reasons } = matchPhrases(splitRubricPhrases(rubric.rubric_text), doc);
      return { rubric, score, reasons };
    })
    .filter((s) => s.score >= MIN_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.rubric.section.localeCompare(b.rubric.section) ||
        a.rubric.rubric_text.localeCompare(b.rubric.rubric_text)
    )
    .slice(0, limit);
}

// রুব্রিকের বিপরীতে সব ওষুধের প্রস্তাব
export function suggestRemediesForRubric(rubric, remedies, { limit = 20, excludeIds = [] } = {}) {
  const phrases = splitRubricPhrases(rubric.rubric_text);
  const exclude = new Set(excludeIds.map(Number));
  return remedies
    .filter((r) => !exclude.has(Number(r.id)))
    .map((remedy) => {
      const { score, reasons } = matchPhrases(phrases, remedyDoc(remedy));
      return { remedy, score, reasons };
    })
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.remedy.name.localeCompare(b.remedy.name))
    .slice(0, limit);
}

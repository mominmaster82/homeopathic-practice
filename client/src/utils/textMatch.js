// রুব্রিক/ওষুধের টেক্সট মেলানোর সাধারণ ভিত্তি।
// linkSuggest (ওষুধ-প্রস্তাব) ও search (রেপার্টরি সার্চ) — দুটোই একই নিয়ম ব্যবহার করে।

export const EN_STOP = new Set([
  'with', 'from', 'that', 'this', 'these', 'those', 'have', 'has', 'had', 'into', 'upon',
  'when', 'where', 'which', 'while', 'after', 'before', 'during', 'other', 'also', 'very',
  'more', 'most', 'some', 'such', 'than', 'then', 'there', 'their', 'them', 'they', 'will',
  'would', 'could', 'should', 'about', 'been', 'being', 'both', 'each', 'over', 'under',
  'again', 'against', 'between', 'through', 'because', 'only', 'same', 'just', 'like',
  'worse', 'better', 'amelioration', 'aggravation', 'symptom', 'symptoms',
]);

export const BN_STOP = new Set([
  'এবং', 'বা', 'ও', 'এর', 'এই', 'সেই', 'যে', 'যা', 'করে', 'হয়', 'হয়ে', 'হলে', 'হতে',
  'থেকে', 'জন্য', 'সাথে', 'মধ্যে', 'উপর', 'নিচে', 'পরে', 'আগে', 'খুব', 'কম', 'বেশি', 'বেশ',
  'একটি', 'একটা', 'কিছু', 'সব', 'না', 'নেই', 'আছে', 'মতো', 'দিকে', 'ধরনের', 'অনেক',
  'তার', 'তাঁর', 'আমার', 'আপনার', 'একই', 'কিন্তু', 'তাই', 'সালে', 'দিন', 'সময়', 'রোগী',
  'বাড়ে', 'বেড়ে', 'ভালো', 'কমে', 'শুরু', 'থাকে', 'লাগে', 'মনে', 'হলো', 'ওঠে', 'আসে',
  'যায়', 'দেয়',
  // গদ্যে ঘন ঘন আসা ক্রিয়া — লক্ষণ-নির্দেশক নয় ("পা ফুলে গেছে")
  'গেছে', 'গিয়েছে', 'এসেছে', 'দিয়েছে', 'হয়েছে',
  // রুব্রিকে ঘন ঘন আসা অথচ লক্ষণ-নির্দেশক নয় এমন শব্দ ("বমি ভাব", "ফেটে যাওয়ার মতো"):
  // এগুলো বাদ না দিলে দুটি সাধারণ শব্দ মিলেই অপ্রাসঙ্গিক রুব্রিক প্রস্তাব হয়ে যায়।
  // পুরো শব্দবন্ধ হুবহু মিললে (যেমন "বমি ভাব") তা এখনও ধরা পড়ে — শুধু আলাদা টোকেন হিসেবে বাদ যায়।
  'ভাব', 'যাওয়া', 'যাওয়ার', 'দিয়ে', 'সহ',
]);

export const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[।,;:.!?()[\]{}"'“”‘’/\\|@#$%^&*+=~`<>_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const wordsOf = (text) => normalize(text).split(' ').filter(Boolean);

export const charLen = (t) => [...t].length;

export const isAsciiWord = (t) => /^[a-z]+$/.test(t);

// বাংলা শব্দ ছোট হলেও অর্থবহ ("হজম", "জিভ"), ইংরেজিতে ছোট শব্দ মিলিয়ে ভুল বাড়ে
export const minStemLen = (t) => (isAsciiWord(t) ? 4 : 3);

// "টনসিল" ↔ "টনসিলিটিস" / "হজম" ↔ "হজমের" — কাণ্ড-শব্দ মিলিয়ে দেখি
export function stemHit(words, token) {
  if (charLen(token) < minStemLen(token)) return null;
  for (const word of words) {
    if (charLen(word) < minStemLen(word)) continue;
    if (word === token || word.startsWith(token) || token.startsWith(word)) return word;
  }
  return null;
}

// এক অক্ষরের বানান-ভুল (cough ↔ couph)। ছোট শব্দে ঢিলেঢালা মিল এড়াতে ৪ অক্ষর থেকে।
export function isNearWord(a, b) {
  if (a === b) return true;
  const A = [...a];
  const B = [...b];
  const la = A.length;
  const lb = B.length;
  if (Math.min(la, lb) < 4 || Math.abs(la - lb) > 1) return false;

  if (la === lb) {
    let diff = 0;
    for (let i = 0; i < la; i++) {
      if (A[i] !== B[i] && ++diff > 1) return false;
    }
    return diff === 1;
  }

  // ছোট শব্দটি বড়টির ভেতরে এক অক্ষর বাদ দিয়ে বসে কি না
  const small = la < lb ? A : B;
  const big = la < lb ? B : A;
  let i = 0;
  let j = 0;
  let skipped = 0;
  while (i < small.length && j < big.length) {
    if (small[i] === big[j]) { i++; j++; continue; }
    if (++skipped > 1) return false;
    j++;
  }
  return true;
}

// বাংলা শব্দের কার-চিহ্ন বাদ দিয়ে ব্যঞ্জন-কাঠামো
// ("ফুলে"/"ফোলা", "মাথাব্যাথা"/"মাথাব্যথা" — একই ব্যঞ্জন, আলাদা কার)
export const bengaliSkeleton = (t) =>
  String(t ?? '').replace(/[\u0981-\u0983\u09BC\u09BE-\u09CD\u09D7\u09E2\u09E3]/g, '');

// হুবহু/কাণ্ড-মিল না পেলে বানান-ভুলের কাছাকাছি শব্দ
export function nearHit(words, token) {
  if (charLen(token) < 4) return null;
  const first = token[0];
  const len = token.length;
  for (const word of words) {
    // প্রথম অক্ষর একই না হলে বানান-ভুলের সম্ভাবনা কম — বাদ দিলে সার্চ দ্রুত হয়
    if (word[0] !== first || Math.abs(word.length - len) > 3) continue;
    if (isNearWord(word, token)) return word;
  }
  return null;
}

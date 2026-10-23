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

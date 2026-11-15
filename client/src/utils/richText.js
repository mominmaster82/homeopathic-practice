// কী-নোটের সীমিত রিচ টেক্সট: বোল্ড, ইটালিক ও রঙ।
// এডিটরের HTML সেভ/প্রদর্শনের আগে allowlist দিয়ে পরিষ্কার করা হয়।

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'P', 'DIV', 'SPAN', 'FONT']);
const DROP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
  'IMG', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'SOURCE', 'FORM', 'INPUT', 'TEXTAREA',
]);
const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;
const HTML_RE = /<\/?[a-z][^>]*>/i;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeHtml(value) {
  return HTML_RE.test(String(value ?? ''));
}

function cleanNode(node) {
  if (node.nodeType === 3) return escapeHtml(node.nodeValue);
  if (node.nodeType !== 1) return '';

  const tag = node.tagName.toUpperCase();
  if (DROP_TAGS.has(tag)) return '';

  const inner = [...node.childNodes].map(cleanNode).join('');
  if (!ALLOWED_TAGS.has(tag)) return inner;
  if (tag === 'BR') return '<br>';

  if (tag === 'SPAN' || tag === 'FONT') {
    const raw = tag === 'FONT' ? node.getAttribute('color') : node.style?.color;
    const color = raw && COLOR_RE.test(raw.trim()) ? raw.trim() : '';
    return color ? `<span style="color:${color}">${inner}</span>` : inner;
  }

  // bold/italic-এর উপরেও রঙ বসতে পারে (যেমন <b style="color:…">)
  const name = tag.toLowerCase();
  const rawColor = node.style?.color;
  const color = rawColor && COLOR_RE.test(rawColor.trim()) ? rawColor.trim() : '';
  return color
    ? `<${name} style="color:${color}">${inner}</${name}>`
    : `<${name}>${inner}</${name}>`;
}

// HTML থেকে শুধু অনুমোদিত ট্যাগ/কালার রেখে বাকি সব বাদ দেয়
export function sanitizeRichText(value) {
  const v = String(value ?? '');
  if (!v || !looksLikeHtml(v)) return v;
  const doc = new DOMParser().parseFromString(v, 'text/html');
  return [...doc.body.childNodes].map(cleanNode).join('');
}

// প্রদর্শনের জন্য: পুরনো প্লেইন টেক্সটের নতুন লাইনও প্যারা হিসেবে থাকে
export function richTextToHtml(value) {
  const v = String(value ?? '');
  if (!v) return '';
  if (!looksLikeHtml(v)) {
    return escapeHtml(v).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
  }
  return sanitizeRichText(v);
}

// সার্চ/প্রস্তাবের জন্য ট্যাগ ছাড়া শুধু লেখা
export function stripRichText(value) {
  const v = String(value ?? '');
  if (!v || !looksLikeHtml(v)) return v;
  const doc = new DOMParser().parseFromString(v, 'text/html');
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('div, p').forEach((el) => el.append('\n'));
  return (doc.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isRichTextEmpty(value) {
  return stripRichText(value).trim() === '';
}

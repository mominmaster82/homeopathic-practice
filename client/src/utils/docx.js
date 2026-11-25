// .docx → HTML (ব্রাউজারে, JSZip দিয়ে) — রঙ/গ্রেড, বোল্ড/ইটালিক, টেবিল ও শেডিং অটুট রাখে।
// DOCX আসলে ZIP; ভেতরের word/document.xml পার্স করে বের করা হয়।
import JSZip from 'jszip';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_HTML_BYTES = 900 * 1024;

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function runParts(run) {
  const rPr = (run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [])[1] || '';
  const style = [];
  const color = (rPr.match(/<w:color w:val="([0-9A-Fa-f]{6})"/) || [])[1];
  if (color && color !== '000000') style.push(`color:#${color}`);
  const bOff = /<w:b [^>]*w:val="(0|false)"/.test(rPr);
  const iOff = /<w:i [^>]*w:val="(0|false)"/.test(rPr);
  if (/<w:b(?:\s[^>]*)?\/>/.test(rPr) && !bOff) style.push('font-weight:700');
  if (/<w:i(?:\s[^>]*)?\/>/.test(rPr) && !iOff) style.push('font-style:italic');
  if (/<w:u [^>]*w:val="single"/.test(rPr)) style.push('text-decoration:underline');
  const sz = (rPr.match(/<w:sz w:val="(\d+)"/) || [])[1];
  if (sz) style.push(`font-size:${(Number(sz) / 2).toFixed(1)}pt`);

  let html = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(br|cr)\s*\/>|<w:tab\s*\/>/g;
  for (const m of run.matchAll(re)) {
    if (m[1] != null) html += escapeHtml(decodeXml(m[1]));
    else if (m[2]) html += '<br/>';
    else html += ' ';
  }
  return { style: style.join(';'), html };
}

function paraHtml(p) {
  const pPr = (p.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/) || [])[1] || '';
  const jc = (pPr.match(/<w:jc w:val="([^"]+)"/) || [])[1];
  const fill = (pPr.match(/<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"/) || [])[1];

  let inner = '';
  let curStyle = null;
  let buf = '';
  const flush = () => {
    if (buf) inner += curStyle ? `<span style="${curStyle}">${buf}</span>` : buf;
    buf = '';
  };
  for (const r of p.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)) {
    const { style, html } = runParts(r[0]);
    if (!html) continue;
    if (style === curStyle) buf += html;
    else {
      flush();
      curStyle = style;
      buf = html;
    }
  }
  flush();
  if (!inner.replace(/<br\/>/g, '').trim() && !fill) return '';

  const plain = inner.replace(/<[^>]+>/g, '');
  const isHeading =
    /^[০-৯0-9]+\./.test(plain) &&
    /font-weight:700/.test(inner) &&
    /font-size:(1[2-9]|[2-9][0-9])/.test(inner);

  const style = [];
  if (jc === 'center') style.push('text-align:center');
  else if (jc === 'right' || jc === 'end') style.push('text-align:right');
  if (fill) style.push(`background:#${fill}`);
  const attrs = `${isHeading ? ' class="doc-h2"' : ''}${style.length ? ` style="${style.join(';')}"` : ''}`;
  return `<p${attrs}>${inner}</p>`;
}

function tableHtml(tbl) {
  const grid = [...tbl.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => Number(m[1]));
  const total = grid.reduce((a, b) => a + b, 0) || 1;
  const rows = [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)];
  let head = '';
  let body = '';
  for (const row of rows) {
    const isHead = /<w:tblHeader\s*\/>/.test(row[0]);
    let cells = '';
    let gi = 0;
    for (const tc of row[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)) {
      const tcPr = (tc[0].match(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/) || [])[1] || '';
      const fill = (tcPr.match(/<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"/) || [])[1];
      const span = Number((tcPr.match(/<w:gridSpan w:val="(\d+)"/) || [])[1] || 1);
      const width = grid.slice(gi, gi + span).reduce((a, b) => a + b, 0);
      gi += span;
      const content = [...tc[0].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
        .map((m) => paraHtml(m[0]))
        .join('');
      const style = [];
      if (width) style.push(`width:${((width / total) * 100).toFixed(2)}%`);
      if (fill) style.push(`background:#${fill}`);
      cells += `<td${style.length ? ` style="${style.join(';')}"` : ''}>${content || '&nbsp;'}</td>`;
    }
    if (isHead) head += `<tr>${cells}</tr>`;
    else body += `<tr>${cells}</tr>`;
  }
  return `<div class="doc-table-wrap"><table class="doc-table doc-cols-${grid.length}">${head ? `<thead>${head}</thead>` : ''}<tbody>${body}</tbody></table></div>`;
}

function normalizeText(s) {
  return s.replace(/\s+/g, '').replace(/\u00a0/g, '');
}

export async function docxToHtml(file) {
  if (!file) throw new Error('কোনো ফাইল নির্বাচন করা হয়নি');
  if (!/\.docx$/i.test(file.name || '')) throw new Error('শুধু .docx ফাইল নেওয়া যায়');
  if (file.size > MAX_FILE_BYTES) throw new Error('ফাইলটি অনেক বড় — সর্বোচ্চ ১৫ MB');

  let xml;
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('missing');
    xml = await entry.async('string');
  } catch {
    throw new Error('ফাইলটি পড়া যায়নি — এটি সঠিক .docx কিনা যাচাই করুন');
  }

  const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) throw new Error('ডকুমেন্টের ভেতরের লেখা পাওয়া যায়নি');
  const body = bodyMatch[1];

  let html = '';
  for (const b of body.matchAll(/<w:(p|tbl)(?:\s[^>]*)?>[\s\S]*?<\/w:\1>/g)) {
    html += b[1] === 'tbl' ? tableHtml(b[0]) : paraHtml(b[0]);
  }

  const htmlBytes = new TextEncoder().encode(html).length;
  if (htmlBytes > MAX_HTML_BYTES) {
    throw new Error('ডকুমেন্টটি অনেক বড় — কনভার্ট করার পর সংরক্ষণসীমা ছাড়িয়ে যাচ্ছে');
  }

  const sourceText = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => decodeXml(m[1]))
    .join('');
  const outputText = decodeXml(html.replace(/<[^>]*>/g, ''));

  return {
    html,
    chars: normalizeText(sourceText).length,
    tables: (html.match(/<table/g) || []).length,
    rows: (html.match(/<tr>/g) || []).length,
    textMatch: normalizeText(sourceText) === normalizeText(outputText),
  };
}

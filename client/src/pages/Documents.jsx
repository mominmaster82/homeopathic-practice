import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { documents as builtinDocuments } from '../data/documents/index.js';
import { docxToHtml } from '../utils/docx.js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtmlText = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const EMPTY_FORM = { title: '', subtitle: '', category: '', printOrientation: 'landscape' };

// বিল্ট-ইন ডকুমেন্টের HTML মেমরিতে প্রস্তুত থাকে; Firestore-এর কপি থাকলে সেটি আগে দেখানো হয়
const initialCache = () => Object.fromEntries(builtinDocuments.map((d) => [d.id, d.html]));

function mergeDocs(remote) {
  const map = new Map();
  for (const d of builtinDocuments) {
    map.set(d.id, { ...d, order: d.order ?? 0, _builtinHtml: d.html, _builtin: true });
  }
  for (const r of remote) {
    const prev = map.get(r.id);
    map.set(r.id, {
      ...prev,
      ...r,
      _builtinHtml: prev?._builtinHtml || null,
      _remote: true,
    });
  }
  return [...map.values()].sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function highlightMatches(root, query) {
  const re = new RegExp(escapeRegExp(query), 'gi');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const tag = node.parentElement?.tagName;
      if (tag === 'MARK' || tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let count = 0;
  for (const node of nodes) {
    const text = node.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = re.exec(text))) {
      if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const mark = document.createElement('mark');
      mark.className = 'doc-hit';
      mark.textContent = match[0];
      frag.appendChild(mark);
      lastIndex = match.index + match[0].length;
      count++;
    }
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode.replaceChild(frag, node);
  }
  return count;
}

function printHtml(doc) {
  const orientation = doc.printOrientation === 'portrait' ? 'portrait' : 'landscape';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtmlText(doc.title)}</title><style>
    @page { size: A4 ${orientation}; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif; color: #0f172a; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc-body { font-size: 10pt; line-height: 1.45; }
    .doc-body p { margin: 0 0 4px; }
    .doc-body .doc-h2 { margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1; break-after: avoid; }
    .doc-body .doc-table-wrap { margin: 6px 0 10px; overflow: visible; }
    .doc-body .doc-table { width: 100%; border-collapse: collapse; }
    .doc-body .doc-table td { border: 1px solid #94a3b8; padding: 3px 5px; vertical-align: top; }
    .doc-body .doc-table thead { display: table-header-group; }
    .doc-body .doc-table tr { break-inside: avoid; }
  </style></head><body><article class="doc-body">${doc.html}</article></body></html>`;
}

export default function Documents() {
  const { isAdmin } = useAuth();

  const [docs, setDocs] = useState(() => mergeDocs([]));
  const [docsLoading, setDocsLoading] = useState(true);
  const [htmlCache, setHtmlCache] = useState(initialCache);
  const [activeId, setActiveId] = useState(builtinDocuments[0]?.id || '');
  const [notice, setNotice] = useState(null);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState(0);
  const [zoom, setZoom] = useState(100);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [formError, setFormError] = useState('');

  const articleRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeId) || docs[0] || null,
    [docs, activeId]
  );
  const activeHtml = activeDoc ? htmlCache[activeDoc.id] || '' : '';

  const reload = async ({ silent = false } = {}) => {
    if (!silent) setDocsLoading(true);
    try {
      const rows = await api.getDocuments();
      const entries = await Promise.all(
        rows.map(async (r) => {
          try {
            return [r.id, await api.getDocumentHtml(r.id)];
          } catch {
            return [r.id, null];
          }
        })
      );
      setDocs(mergeDocs(rows));
      setHtmlCache((prev) => {
        const next = { ...prev };
        for (const [id, html] of entries) if (html) next[id] = html;
        return next;
      });
    } catch (err) {
      setNotice({ ok: false, text: err.message || 'ডকুমেন্ট তালিকা লোড করা যায়নি' });
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    el.innerHTML = activeHtml;
    setMatches(0);
    if (!activeHtml || !search) return;
    const count = highlightMatches(el, search);
    setMatches(count);
    if (count) el.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeHtml, search]);

  const selectDoc = (id) => {
    setActiveId(id);
    setQuery('');
    setSearch('');
    setMatches(0);
  };

  const printDoc = () => {
    if (!activeHtml || !activeDoc) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(printHtml({ ...activeDoc, html: activeHtml }));
    frameDoc.close();
    frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 400);
    setTimeout(() => {
      if (frame.isConnected) frame.remove();
    }, 60000);
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setFormError('');
    setProgress('');
    resetFileInput();
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!activeDoc) return;
    setEditing(activeDoc);
    setForm({
      title: activeDoc.title || '',
      subtitle: activeDoc.subtitle || '',
      category: activeDoc.category || '',
      printOrientation: activeDoc.printOrientation || 'landscape',
    });
    setFile(null);
    setFormError('');
    setProgress('');
    resetFileInput();
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFile(null);
    setFormError('');
  };

  const updateField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim()) {
      setFormError('ডকুমেন্টের নাম দিতে হবে');
      return;
    }
    if (!editing && !file) {
      setFormError('একটি .docx ফাইল নির্বাচন করুন');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      let converted = null;
      if (file) {
        setProgress('ফাইল পড়া ও কনভার্ট হচ্ছে…');
        converted = await docxToHtml(file);
        if (!converted.chars) throw new Error('ফাইলে কোনো লেখা পাওয়া যায়নি');
      }

      setProgress('সফটওয়্যারে সংরক্ষণ হচ্ছে…');
      const saved = await api.saveDocument(
        {
          id: editing?.id,
          title: form.title,
          subtitle: form.subtitle,
          category: form.category,
          source: file?.name || editing?.source || '',
          printOrientation: form.printOrientation,
          chars: converted?.chars,
          tables: converted?.tables,
          rows: converted?.rows,
        },
        converted?.html || null
      );

      await reload({ silent: true });
      setActiveId(saved.id);
      setQuery('');
      setSearch('');
      setFormOpen(false);
      setEditing(null);
      setFile(null);
      setNotice({
        ok: true,
        text: converted
          ? `সংরক্ষিত হয়েছে — ${converted.chars.toLocaleString('bn-BD')} অক্ষর, ${converted.tables.toLocaleString('bn-BD')} টেবিল${
              converted.textMatch ? '' : ' (কিছু লেখার ফরম্যাট মেলেনি, যাচাই করে নিন)'
            }`
          : 'ডকুমেন্টের তথ্য সংরক্ষিত হয়েছে',
      });
    } catch (err) {
      setFormError(err.message || 'সংরক্ষণ করা যায়নি');
    } finally {
      setSaving(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">সময় নির্দেশিকা</h2>
          <p className="page-sub">ডকুমেন্ট লাইব্রেরি — রেফারেন্স পড়ুন, ভেতরে খুঁজুন ও প্রিন্ট করুন।</p>
        </div>
        <span className="badge border-teal-200 bg-teal-50 text-teal-700">রেফারেন্স লাইব্রেরি</span>
      </div>

      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
            notice.ok ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          <span>{notice.text}</span>
          <button className="text-xs font-semibold opacity-70 hover:opacity-100" onClick={() => setNotice(null)}>
            বন্ধ
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card h-max p-3 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <span className="section-title">ডকুমেন্ট তালিকা</span>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                নতুন ফাইল
              </button>
            )}
          </div>
          <div className="space-y-1">
            {docs.map((d) => {
              const active = d.id === activeDoc?.id;
              return (
                <button
                  key={d.id}
                  onClick={() => selectDoc(d.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    active
                      ? 'border-teal-200 bg-teal-50'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`block text-sm font-semibold ${active ? 'text-teal-800' : 'text-slate-700'}`}>
                    {d.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {d.category || 'ডকুমেন্ট'}
                    {d._remote && !d._builtinHtml ? ' · আপলোড করা' : ''}
                  </span>
                </button>
              );
            })}
          </div>
          {docsLoading && <p className="mt-2 px-2 text-[11px] text-slate-400">তালিকা লোড হচ্ছে…</p>}
          <p className="mt-3 border-t border-slate-100 px-2 pt-3 text-[11px] leading-relaxed text-slate-400">
            এই ডকুমেন্টগুলো শুধু পড়ার জন্য। রেপার্টরি বা ম্যাটেরিয়া মেডিকার সাথে কোনো ডেটা লিংক নেই।
          </p>
        </aside>

        <section className="card overflow-hidden">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{activeDoc?.title || '—'}</h3>
                <p className="text-xs text-slate-500">{activeDoc?.subtitle || ''}</p>
              </div>
              {isAdmin && activeDoc && (
                <button className="btn btn-ghost btn-sm" onClick={openEdit}>
                  সম্পাদনা
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input min-w-[220px] flex-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ডকুমেন্টের ভেতরে খুঁজুন…"
                aria-label="ডকুমেন্টের ভেতরে খুঁজুন"
              />
              {search && <span className="text-xs text-slate-500">{matches}টি মিল</span>}
              <div className="flex items-center gap-1">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setZoom((z) => Math.max(80, z - 10))}
                  disabled={zoom <= 80}
                  aria-label="লেখা ছোট করুন"
                >
                  A−
                </button>
                <span className="w-10 text-center text-xs text-slate-500">{zoom}%</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setZoom((z) => Math.min(150, z + 10))}
                  disabled={zoom >= 150}
                  aria-label="লেখা বড় করুন"
                >
                  A+
                </button>
              </div>
              <button className="btn btn-primary btn-sm" onClick={printDoc} disabled={!activeHtml}>
                মুদ্রণ / PDF
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {!activeHtml ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {docsLoading ? 'ডকুমেন্ট লোড হচ্ছে…' : 'এই ডকুমেন্টের লেখা পাওয়া যায়নি'}
              </p>
            ) : (
              <article ref={articleRef} className="doc-body" style={{ zoom: zoom / 100 }} />
            )}
          </div>
        </section>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12"
          role="dialog"
          aria-modal="true"
          aria-label={editing ? 'ডকুমেন্ট সম্পাদনা' : 'নতুন ডকুমেন্ট'}
        >
          <form className="card w-full max-w-xl space-y-4 p-5" onSubmit={submit}>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {editing ? 'ডকুমেন্ট সম্পাদনা' : 'নতুন ফাইল যোগ করুন'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                .docx ফাইল স্বয়ংক্রিয়ভাবে কনভার্ট হয়ে সফটওয়্যারে জমা থাকবে। রঙ/গ্রেড, বোল্ড ও টেবিল অটুট থাকে।
              </p>
            </div>

            <label className="block text-xs font-semibold text-slate-600">
              ডকুমেন্টের নাম *
              <input
                className="input mt-1 w-full"
                value={form.title}
                onChange={updateField('title')}
                placeholder="যেমন: সময় নির্দেশিকা"
                maxLength={120}
                autoFocus
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-600">
                বিভাগ
                <input
                  className="input mt-1 w-full"
                  value={form.category}
                  onChange={updateField('category')}
                  placeholder="যেমন: সময় ও ঋতু"
                  maxLength={60}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                মুদ্রণের দিক
                <select
                  className="input mt-1 w-full"
                  value={form.printOrientation}
                  onChange={updateField('printOrientation')}
                >
                  <option value="landscape">আড়াআড়ি (Landscape)</option>
                  <option value="portrait">খাড়া (Portrait)</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-600">
              সংক্ষিপ্ত বর্ণনা
              <input
                className="input mt-1 w-full"
                value={form.subtitle}
                onChange={updateField('subtitle')}
                placeholder="যেমন: কেন্ট রেপার্টরি অনুযায়ী ১ম, ২য় ও ৩য় গ্রেড"
                maxLength={220}
              />
            </label>

            <label className="block text-xs font-semibold text-slate-600">
              {editing ? 'ফাইল বদলাতে চাইলে নতুন .docx দিন (ঐচ্ছিক)' : '.docx ফাইল *'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="input mt-1 w-full file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-teal-700"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-400">
                {file
                  ? `নির্বাচিত: ${file.name}`
                  : editing?.source
                    ? `বর্তমান ফাইল: ${editing.source}`
                    : 'সর্বোচ্চ ১৫ MB; শুধু Word (.docx)'}
              </span>
            </label>

            {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            {progress && <p className="text-xs text-slate-500">{progress}</p>}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" className="btn btn-ghost" onClick={closeForm} disabled={saving}>
                বাতিল
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'অপেক্ষা করুন…' : editing ? 'সংরক্ষণ করুন' : 'যোগ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

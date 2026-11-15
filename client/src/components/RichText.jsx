import { useEffect, useRef } from 'react';
import { escapeHtml, richTextToHtml } from '../utils/richText.js';

const COLORS = [
  { label: 'কালো', value: '#0f172a' },
  { label: 'লাল', value: '#dc2626' },
  { label: 'সবুজ', value: '#16a34a' },
  { label: 'নীল', value: '#2563eb' },
  { label: 'কমলা', value: '#ea580c' },
  { label: 'বেগুনি', value: '#7c3aed' },
];

// কী-নোট এডিটর: বোল্ড, ইটালিক ও লেখার রঙ — এর বেশি কিছু নয়
export default function RichTextField({ value, onChange, placeholder = '' }) {
  const ref = useRef(null);

  // বাইরের মান বদলালে (যেমন সম্পাদনা খুললে) এডিটরে বসাই — টাইপিংয়ের সময় নয়
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const incoming = richTextToHtml(value || '');
    if (el.innerHTML !== incoming) el.innerHTML = incoming;
  }, [value]);

  const run = (command, arg, useCss = false) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    document.execCommand('styleWithCSS', false, useCss);
    document.execCommand(command, false, arg);
    onChange(el.innerHTML);
  };

  // পেস্ট করা লেখা প্লেইন টেক্সট হিসেবে বসাই — বাইরের স্টাইল আসবে না
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const html = text.split(/\r?\n/).map(escapeHtml).join('<br>');
    document.execCommand('insertHTML', false, html);
    onChange(ref.current.innerHTML);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1">
        <button
          type="button"
          title="বোল্ড"
          aria-label="বোল্ড"
          onMouseDown={(e) => {
            e.preventDefault();
            run('bold');
          }}
          className="h-7 w-7 rounded font-bold text-slate-700 hover:bg-slate-200"
        >
          B
        </button>
        <button
          type="button"
          title="ইটালিক"
          aria-label="ইটালিক"
          onMouseDown={(e) => {
            e.preventDefault();
            run('italic');
          }}
          className="h-7 w-7 rounded font-serif italic text-slate-700 hover:bg-slate-200"
        >
          I
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={`রঙ: ${c.label}`}
            aria-label={`রঙ: ${c.label}`}
            onMouseDown={(e) => {
              e.preventDefault();
              run('foreColor', c.value, true);
            }}
            className="h-5 w-5 rounded-full ring-1 ring-slate-300 hover:scale-110"
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onPaste={onPaste}
        className="rich-editor min-h-[5.5rem] px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none"
      />
    </div>
  );
}

// সেভ করা কী-নোট নিরাপদে (sanitize করে) দেখাই
export function RichTextView({ value, className = '' }) {
  const html = richTextToHtml(value);
  if (!html) return null;
  return (
    <div
      className={`rich-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

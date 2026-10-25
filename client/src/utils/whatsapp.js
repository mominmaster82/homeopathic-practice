// WhatsApp-এ প্রেসক্রিপশন পাঠানোর টেক্সট — ওষুধের নাম ও শক্তি ইচ্ছাকৃতভাবে বাদ।
// wa.me লিংকে শুধু টেক্সট যায়; PDF সংযুক্ত হয় না। ব্যবহারকারী WhatsApp-এ Send চাপবেন।
import { extraCaseFields } from '../pages/caseFields.js';

export function normalizeWhatsAppPhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^01[3-9]\d{8}$/.test(digits)) digits = `88${digits}`;
  else if (/^1[3-9]\d{8}$/.test(digits)) digits = `880${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

export function buildPrescriptionMessage({ patient, caseData, settings = {}, dateText = '' }) {
  const lines = [];
  lines.push(settings.clinic_name || 'হোমিওপ্যাথি ক্লিনিক');
  if (settings.doctor_name) lines.push(settings.doctor_name);
  const contact = [settings.address, settings.phone, settings.email].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);

  lines.push('');
  lines.push(`রোগী: ${patient?.name || '—'}`);
  const bio = [
    patient?.age ? `বয়স: ${patient.age}` : '',
    patient?.gender ? `লিঙ্গ: ${patient.gender}` : '',
  ].filter(Boolean).join(' · ');
  if (bio) lines.push(bio);
  lines.push(`কেস: #${caseData?.id ?? '—'} · তারিখ: ${dateText || '—'}`);

  lines.push('');
  if (caseData?.symptoms) lines.push(`লক্ষণ: ${caseData.symptoms}`);
  for (const field of extraCaseFields) {
    if (caseData?.[field.name]) lines.push(`${field.label}: ${caseData[field.name]}`);
  }
  if (caseData?.notes) lines.push(`নোট: ${caseData.notes}`);

  const doses = (caseData?.prescriptions || []).map((rx, i) => `${i + 1}. ${rx.dose || '—'}`);
  if (doses.length) {
    lines.push('');
    lines.push('প্রেসক্রিপশন:');
    lines.push(...doses);
  }

  if (settings.footer_note) {
    lines.push('');
    lines.push(settings.footer_note);
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

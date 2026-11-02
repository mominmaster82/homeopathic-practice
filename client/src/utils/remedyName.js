// প্রেসক্রিপশনে ছাপার জন্য ওষুধের নামের সংক্ষিপ্ত রূপ।
// বেশি ব্যবহৃত ওষুধে প্রচলিত সংক্ষেপ; অন্যগুলোতে নিয়ম:
// এক শব্দ: প্রথম ৪ অক্ষর + "." (Belladonna → Bell.)
// দুই শব্দ: গণ + "-" + প্রজাতি (Nux Vomica → Nux-vom., Rhus Tox → Rhus-tox.)
const COMMON_ABBR = {
  'aconite': 'Acon.',
  'alumen': 'Alumen.',
  'alumina': 'Alum.',
  'apis mellifica': 'Apis',
  'argentum nitricum': 'Arg-n.',
  'arnica montana': 'Arn.',
  'belladonna': 'Bell.',
  'bryonia': 'Bry.',
  'calcarea carb': 'Calc-c.',
  'calcarea fluorica': 'Calc-f.',
  'calcarea phos': 'Calc-p.',
  'calcarea sulph': 'Calc-s.',
  'carbo animalis': 'Carb-an.',
  'carbo veg': 'Carb-v.',
  'china': 'Chin.',
  'euphorbium': 'Euphorb.',
  'euphrasia': 'Euphr.',
  'ferrum met': 'Ferr.',
  'graphites': 'Graph.',
  'hepar sulph': 'Hep.',
  'hydrangea': 'Hydra.',
  'hydrastis': 'Hydr.',
  'ignatia': 'Ign.',
  'kali sulph': 'Kali-s.',
  'lachesis': 'Lach.',
  'ledum': 'Led.',
  'lycopodium': 'Lyc.',
  'medorrhinum': 'Med.',
  'mercurius corrosivus': 'Merc-c.',
  'natrum mur': 'Nat-m.',
  'natrum sulph': 'Nat-s.',
  'nitric acid': 'Nit-ac.',
  'nux moschata': 'Nux-m.',
  'nux vomica': 'Nux-v.',
  'phosphoric acid': 'Phos-ac.',
  'phosphorus': 'Phos.',
  'polygala': 'Polyg.',
  'polyporus': 'Polypor.',
  'pulsatilla': 'Puls.',
  'rhus tox': 'Rhus-t.',
  'sepia': 'Sep.',
  'silicea': 'Sil.',
  'staphysagria': 'Staph.',
  'sulphur': 'Sulph.',
  'thuja': 'Thuj.',
  'tuberculinum': 'Tub.',
  'veratrum album': 'Verat.',
  'veratrum viride': 'Verat-v.',
  'zincum met': 'Zinc.',
};

export function abbreviateRemedy(name) {
  const full = String(name ?? '').trim();
  if (!full) return '';
  const words = full
    .replace(/\(.*?\)/g, ' ')
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return full;

  const key = words.join(' ').toLowerCase();
  if (COMMON_ABBR[key]) return COMMON_ABBR[key];

  const genus = words[0];
  if (words.length === 1) {
    const part = genus.length <= 4 ? genus : genus.slice(0, 4);
    return `${part.charAt(0).toUpperCase()}${part.slice(1)}.`;
  }

  const genusPart = genus.length <= 4 ? genus : genus.slice(0, 4);
  const species = words[1];
  const speciesPart = species.length <= 4 ? species : species.slice(0, 3);
  return `${genusPart.charAt(0).toUpperCase()}${genusPart.slice(1)}-${speciesPart.toLowerCase()}.`;
}

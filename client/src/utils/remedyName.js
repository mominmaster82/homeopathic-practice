// প্রেসক্রিপশনে ছাপার জন্য ওষুধের নামের সংক্ষিপ্ত রূপ।
// বেশি ব্যবহৃত ওষুধে প্রচলিত সংক্ষেপ; অন্যগুলোতে নিয়ম:
// এক শব্দ: প্রথম ৪ অক্ষর + "." (Belladonna → Bell.)
// দুই শব্দ: গণ + "-" + প্রজাতি (Nux Vomica → Nux-vom., Rhus Tox → Rhus-tox.)
const COMMON_ABBR = {
  'aconite': 'Acon.',
  'allium cepa': 'All-c.',
  'allium sativum': 'All-s.',
  'alumen': 'Alumen.',
  'alumina': 'Alum.',
  'antimonium crud': 'Ant-c.',
  'antimonium iodatum': 'Ant-i.',
  'antimonium sulphuratum aureum': 'Ant-s-a.',
  'antimonium tart': 'Ant-t.',
  'apis mellifica': 'Apis',
  'argentum cyanatum': 'Arg-cy.',
  'argentum metallicum': 'Arg.',
  'argentum nitricum': 'Arg-n.',
  'argentum sulphuratum': 'Arg-s.',
  'arnica montana': 'Arn.',
  'arsenicum album': 'Ars.',
  'arsenicum bromatum': 'Ars-br.',
  'arsenicum iodatum': 'Ars-i.',
  'arsenicum sulphuratum flavum': 'Ars-s-f.',
  'aurum bromatum': 'Aur-br.',
  'aurum iodatum': 'Aur-i.',
  'aurum met': 'Aur.',
  'aurum sulphuratum': 'Aur-s.',
  'belladonna': 'Bell.',
  'bellis perennis': 'Bell-p.',
  'bryonia': 'Bry.',
  'calcarea acetica': 'Calc-ac.',
  'calcarea arsenicosa': 'Calc-ar.',
  'calcarea bromata': 'Calc-br.',
  'calcarea carb': 'Calc-c.',
  'calcarea fluorica': 'Calc-f.',
  'calcarea iodata': 'Calc-i.',
  'calcarea lactica': 'Calc-lac.',
  'calcarea oxalica': 'Calc-ox.',
  'calcarea phos': 'Calc-p.',
  'calcarea picrata': 'Calc-pic.',
  'calcarea sulph': 'Calc-s.',
  'carbo animalis': 'Carb-an.',
  'carbo veg': 'Carb-v.',
  'china': 'Chin.',
  'cuprum met': 'Cupr.',
  'euphorbium': 'Euphorb.',
  'euphrasia': 'Euphr.',
  'ferrum met': 'Ferr.',
  'ferrum phos': 'Ferr-p.',
  'graphites': 'Graph.',
  'hepar sulph': 'Hep.',
  'hydrangea': 'Hydra.',
  'hydrastis': 'Hydr.',
  'ignatia': 'Ign.',
  'kali bich': 'Kali-bi.',
  'kali brom': 'Kali-br.',
  'kali carb': 'Kali-c.',
  'kali iod': 'Kali-i.',
  'kali mur': 'Kali-m.',
  'kali phos': 'Kali-p.',
  'kali sulph': 'Kali-s.',
  'lachesis': 'Lach.',
  'ledum': 'Led.',
  'lycopodium': 'Lyc.',
  'magnesia carb': 'Mag-c.',
  'magnesia mur': 'Mag-m.',
  'magnesia phos': 'Mag-p.',
  'magnesia sulphurica': 'Mag-s.',
  'medorrhinum': 'Med.',
  'merc sol': 'Merc.',
  'mercurius corrosivus': 'Merc-c.',
  'natrum carb': 'Nat-c.',
  'natrum mur': 'Nat-m.',
  'natrum phos': 'Nat-p.',
  'natrum sulph': 'Nat-s.',
  'nitric acid': 'Nit-ac.',
  'nux moschata': 'Nux-m.',
  'nux vomica': 'Nux-v.',
  'phosphoric acid': 'Phos-ac.',
  'phosphorus': 'Phos.',
  'plumbum met': 'Plumb.',
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

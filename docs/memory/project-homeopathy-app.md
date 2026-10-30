---
name: project-homeopathy-app
description: Homeopathy practice app (Bengali) — repertory, materia medica, case taking; lives in OneDrive Qoder 2026-09-19/2ec566b7, NOT the default working dir
metadata:
  type: reference
---

হোমিওপ্যাথিক সফটওয়্যার প্রজেক্টের আসল লোকেশন:
`C:\Users\Smart\OneDrive\Documents\Qoder\2026-09-19\2ec566b7`

- React + Vite + Tailwind (client), Node/Express + SQLite `node:sqlite` (server), Firebase ও আছে (.firebaserc, firebase-upload.mjs)
- **গুরুত্বপূর্ণ:** ক্লায়েন্ট (client/src/services/api.js) সরাসরি **Firestore** পড়ে/লেখে — Express API ব্যবহার করে না। Express+SQLite মূলত সোর্স/সিড; `server/db/data.js` → seed → SQLite → `firebase-upload.mjs`/`firebase-sync-clinical.mjs` → Firestore।
- ডেটা মডেল (server/db/data.js → schema.sql): `remedies` (keynotes, clinical, better, worse) + `rubrics` (section, text) + `links` → `rubric_remedies` (rubric, remedy, grade 1-3) — links-ই ম্যাটেরিয়া মেডিকা ও রেপার্টরির সেতু
- অ্যানালাইসিস (server/routes/analysis.js): নির্বাচিত রুব্রিকের গ্রেড যোগ করে স্কোর, সাথে keynotes দেখানো হয় (Express-এ; ক্লায়েন্টে Firestore-ভিত্তিক আলাদা লজিক)
- ২০২৬-১০-১৭: **Clinical সেকশন যোগ হয়েছে** — ৯৮টি রোগনাম-রুব্রিক + ৫৪১ লিংক, SQLite ও Firestore দুই-ই সিঙ্কড। Production counters, টেস্ট-এন্ট্রি ক্লিনআপ ও max-ID নিয়মের জন্য [[project-firestore-production]] দেখুন।
- ২০২৬-১০-২৩: **ধাপ ৪** — ৬০টি নতুন রুব্রিক (Mind/Head/Stomach/Abdomen/Female/Chest-Respiratory/Extremities/Skin/Fever) + ২৩২টি লিংক; SQLite ও Firestore সিঙ্কড (নতুন id 1132–1191)। Firestore এখন ৬০৬ রুব্রিক, ৩২৭১ লিংক।
- ২০২৬-১০-৩০: **ধাপ ৫ — ওষুধ ৫০০**। ডেটা এখন তিন ফাইলে: `data.js` (বেস ১৮০) + `remedies-300.js` (১২০) + `remedies-500.js` (২০০); `data.js` শুধু `extraRemedies`/`extraLinks` ও `extraRemedies2`/`extraLinks2` স্প্রেড করে। মোট ৫০০ ওষুধ, ৬৭৫ রুব্রিক, ৫,৫৩৫ লিংক। লাইভ: `https://homeopathy-clinic-7f4e0.web.app` (Firebase project `homeopathy-clinic-7f4e0`)। সিঙ্কের ক্রম: `seed.js` → `firebase-sync-new-remedies.mjs --apply` → `firebase-sync-rubrics.mjs --apply`; ডিপ্লয় `npm run build` (client) → `firebase deploy --only hosting`। commit `9f9ced5`, `main`-এ পুশ করা।
- সতর্কতা: পুরোনো `firebase-upload.mjs` প্রতিবার চালালে `rubric_links` ডুপ্লিকেট হয় (auto-ID create)। আপডেটের জন্য targeted/idempotent sync scripts (`firebase-sync-clinical.mjs`, `firebase-sync-rubrics.mjs`) ব্যবহার করুন; এগুলো শুধু অনুপস্থিত যোগ করে, মোছে না।
- সতর্কতা (২০২৬-১০-১৮): **ব্যবহারকারী অ্যাপের UI দিয়ে production ডেটা সম্পাদনা করেন, তাই Firestore ও `data.js` এক নয়।** প্রমাণ: Sanguinaria-র কী-নোট Firestore-এ বদলানো ছিল যা `data.js`-এ ছিল না; রি-সিড করা লোকাল db-তে ৩০১৬ লিংক, Firestore-এ ৩০১৯ (পার্থক্য = কাস্টম রেকর্ড)। তাই পুরো ডেটা আবার আপলোড/সিঙ্ক করলে ব্যবহারকারীর সম্পাদনা মুছে যেতে পারে — সবসময় targeted, এক-ঘর-বিশিষ্ট আপডেট করুন। রুব্রিক মিলানোর সময় whitespace বাদ দিয়ে `(section, rubric_text)` মিলান — production টেক্সটে স্পেস ভিন্ন হতে পারে (বিস্তারিত [[project-firestore-production]])।
- ডেটা লেখার নিয়ম: ওষুধের কী-নোট/ক্লিনিক্যাল টেক্সট **রুব্রিকের শব্দচয়নে** লিখতে হয় (গদ্য নয়), নইলে `client/src/utils/linkSuggest.js`-এর প্রস্তাব-ইঞ্জিন মিল ধরতে পারে না — এটি শব্দ-মিল ভিত্তিক, অর্থ বোঝে না। প্রতিশব্দ (পাকস্থলী/পেট, জিহ্বা/জিভ, ঝাল সর্দি/জ্বালাপোড়া স্রাব) এখনও মেলে না। মোডালিটি শব্দ (ভালো/বাড়ে) ইচ্ছাকৃতভাবে বাদ পড়ে, তাই দিক নির্দেশের জন্য better/worse ঘর পূরণ করতে হয়।
- `clinical` ঘর এখন শুধু প্রদর্শনের — Clinical সেকশনের আলাদা রুব্রিক আছে
- README রোডম্যাপ: ধাপ ১ শেষ; ধাপ ২ ডেটা সম্প্রসারণ চলমান (data.js-এ ২০২৬-১০-০১ এ ওষুধ যোগ হয়েছে)
- ২০২৬-১০-২৫: **অ্যাক্সেস মডেল** — মালিকের একক অ্যাকাউন্ট `super_admin` (সব ডাক্তারি ফিচার + ইউজার/রোল নিয়ন্ত্রণ); ভবিষ্যতের ইউজার `subscriber`, ম্যানুয়াল সাবস্ক্রিপশনে। Subscriber শুধু রেপার্টরি/ম্যাটেরিয়া রেফারেন্স পড়তে পারবে; কোনো সেভ/এডিট/ডিলিট নয়; রোগী/কেস/প্রেসক্রিপশন/সেটিংস শুধু অ্যাডমিন। Firestore rules ও ক্লায়েন্ট UI দুই-ই এ নিয়ম প্রয়োগ করে।
- ২০২৬-১০-২৬: **সাবস্ক্রিপশন মেয়াদ** — subscriber তৈরি বা রিনিউ করার সময় থেকে এক বছর (`users/{uid}.expires_at` Timestamp)। মেয়াদ শেষে অ্যাক্সেস স্বয়ংক্রিয় বন্ধ; super_admin-এর মেয়াদসীমা নেই; Users পেজে ‘রিনিউ (১ বছর)’ ক্রিয়া।
- প্রেসক্রিপশন প্রিন্ট/PDF-এ ওষুধের নাম ও শক্তি ইচ্ছাকৃতভাবে বাদ; WhatsApp শেয়ারেও রোগী/কেস/লক্ষণ/ডোজ যায়, ওষুধের নাম/শক্তি যায় না। এটি বাগ নয় — [[prescription-output-privacy]]।

**Why:** সেশনের ওয়ার্কিং ডিরেক্টরি অনেক সময় খালি থাকে (যেমন 2026-10-16/c31545ee); আসল কোড এই OneDrive পাথে।
**How to apply:** হোমিওপ্যাথি অ্যাপের কাজ বলা হলে এই পাথে গিয়ে কাজ করুন।

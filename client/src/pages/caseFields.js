// কেস এন্ট্রির অতিরিক্ত (পারিপার্শিক) ফিল্ড — CaseTaking ও PatientProfile উভয়ে ব্যবহৃত।
// label = প্রদর্শন নাম, placeholder = ইনপুট ইঙ্গিত, type='input' হলে এক-লাইন ইনপুট (নয়তো textarea)।
export const extraCaseFields = [
  {
    name: 'duration',
    label: 'কতদিন হলো',
    type: 'input',
    placeholder: 'কতদিন হলো (যেমন: ৩ সপ্তাহ / ২ মাস)',
  },
  {
    name: 'cause',
    label: 'কারণ',
    placeholder: 'কারণ — কীসে শুরু হলো (যেমন: ঠান্ডা লাগার পরে, ভিজে কাপড়ে, রাগের মাথায়)',
  },
  {
    name: 'aggravation',
    label: 'কি করলে বাড়ে',
    placeholder: 'কি করলে বাড়ে (যেমন: রাতে, গরমে, হাঁটলে, খাওয়ার পরে)',
  },
  {
    name: 'amelioration',
    label: 'কি করলে কমে',
    placeholder: 'কি করলে কমে (যেমন: বিশ্রামে, ঠান্ডায়, শুয়ে থাকলে)',
  },
  {
    name: 'past_medication',
    label: 'পূর্বে ওষুধ সেবন',
    placeholder: 'আগে কোনো ওষুধ সেবন করেছেন কি? (নাম ও ফলাফল লিখুন)',
  },
];

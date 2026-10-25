// ইউজার রোল/স্ট্যাটাস সেট করার CLI — ম্যানুয়াল সাবস্ক্রিপশন ব্যবস্থাপনার জন্য।
// ডিফল্ট dry-run; আসলে লিখতে --apply দিন।
//
//   node firebase-set-role.mjs --list
//   node firebase-set-role.mjs --email user@example.com --role subscriber --status active --apply
//   node firebase-set-role.mjs --email user@example.com --role subscriber --status active \
//     --create --password 'Secret123' --name 'Dr. Karim' --apply
//   node firebase-set-role.mjs --email user@example.com --delete --apply
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const APPLY = process.argv.includes('--apply');
const LIST = process.argv.includes('--list');
const CREATE = process.argv.includes('--create');
const DELETE = process.argv.includes('--delete');
const ROLES = ['super_admin', 'subscriber'];
const STATUSES = ['active', 'suspended'];

if (!existsSync('./firebase-key.json')) {
  console.error('firebase-key.json পাওয়া যায়নি — Service Account কী এই ফোল্ডারে রাখুন।');
  process.exit(1);
}

const key = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const adminAuth = getAuth();

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const nowBD = () => new Date(Date.now() + BD_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');

const flag = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return '';
  const value = process.argv[i + 1];
  return value && !value.startsWith('--') ? value : '';
};

async function listUsers() {
  const authUsers = [];
  let pageToken;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    authUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const profiles = new Map(
    (await db.collection('users').get()).docs.map((d) => [d.id, d.data()])
  );

  console.log(`Firebase Auth ইউজার: ${authUsers.length} | users প্রোফাইল: ${profiles.size}\n`);
  for (const u of authUsers) {
    const p = profiles.get(u.uid);
    const role = p?.role || '—';
    const status = p?.status || '—';
    console.log(`${u.email || '(ইমেইল নেই)'}  uid=${u.uid}  role=${role}  status=${status}`);
    if (p) profiles.delete(u.uid);
  }
  if (profiles.size > 0) {
    console.log('\nAuth-এ নেই এমন users ডকুমেন্ট (পরিষ্কার করা দরকার):');
    for (const [uid, p] of profiles) {
      console.log(`  ${uid}  ${p.email || ''}  role=${p.role || '—'}  status=${p.status || '—'}`);
    }
  }
}

async function deleteUser() {
  const email = flag('email').trim().toLowerCase();
  if (!email) throw new Error('--email দিন');

  let authUser;
  try {
    authUser = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') throw new Error('এই ইমেইলে কোনো Auth ইউজার নেই');
    throw err;
  }

  console.log(`মুছে ফেলা হবে: ${email} (uid=${authUser.uid}) ও users/${authUser.uid}`);
  console.log(`অবস্থা: ${APPLY ? 'আসলে মুছবে (--apply)' : 'শুধু dry-run'}`);
  if (!APPLY) {
    console.log('\nমুছতে চাইলে আবার --apply দিয়ে চালান।');
    return;
  }

  await db.doc(`users/${authUser.uid}`).delete();
  await adminAuth.deleteUser(authUser.uid);
  console.log('ইউজার ও প্রোফাইল মুছে ফেলা হয়েছে।');
}

async function setRole() {
  const email = flag('email').trim().toLowerCase();
  const role = flag('role').trim();
  const status = flag('status').trim();
  const name = flag('name').trim();
  const password = flag('password');

  if (!email) throw new Error('--email দিন');
  if (role && !ROLES.includes(role)) throw new Error(`--role হবে: ${ROLES.join(' | ')}`);
  if (status && !STATUSES.includes(status)) throw new Error(`--status হবে: ${STATUSES.join(' | ')}`);

  let authUser = null;
  try {
    authUser = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  if (!authUser && !CREATE) {
    throw new Error('এই ইমেইলে Auth ইউজার নেই। নতুন অ্যাকাউন্ট বানাতে --create --password দিন।');
  }
  if (!authUser && (!password || password.length < 6)) {
    throw new Error('নতুন ইউজার বানাতে --password (কমপক্ষে ৬ অক্ষর) দিন।');
  }
  if (!authUser && !role) throw new Error('নতুন ইউজারের জন্য --role দিন।');

  const existing = authUser
    ? (await db.doc(`users/${authUser.uid}`).get()).data()
    : null;

  const finalRole = role || existing?.role;
  const finalStatus = status || existing?.status || 'active';
  if (!finalRole) {
    throw new Error('এই ইউজারের কোনো রোল নেই — --role super_admin|subscriber দিন।');
  }

  const planned = {
    email,
    name: name || existing?.name || authUser?.displayName || '',
    role: finalRole,
    status: finalStatus,
  };

  console.log(authUser ? 'বিদ্যমান Auth ইউজার পাওয়া গেছে।' : 'নতুন Auth ইউজার তৈরি হবে।');
  console.log('পরিকল্পিত users ডকুমেন্ট:', planned);
  console.log(`অবস্থা: ${APPLY ? 'আসলে লিখবে (--apply)' : 'শুধু dry-run'}`);

  if (!APPLY) {
    console.log('\nলিখতে চাইলে আবার --apply দিয়ে চালান।');
    return;
  }

  if (!authUser) {
    authUser = await adminAuth.createUser({
      email,
      password,
      displayName: planned.name || undefined,
      emailVerified: true,
    });
    console.log(`Auth ইউজার তৈরি হয়েছে: uid=${authUser.uid}`);
  }

  const createdAt = existing?.created_at || nowBD();
  await db.doc(`users/${authUser.uid}`).set(
    { ...planned, created_at: createdAt, updated_at: nowBD() },
    { merge: true }
  );
  console.log(`users/${authUser.uid} সংরক্ষণ হয়েছে — role=${finalRole}, status=${finalStatus}`);
}

try {
  if (LIST) await listUsers();
  else if (DELETE) await deleteUser();
  else await setRole();
} catch (err) {
  console.error('ত্রুটি:', err.message || err);
  process.exit(1);
}

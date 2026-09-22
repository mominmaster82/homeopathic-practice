import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'homeopathy.db');

export const db = new DatabaseSync(dbPath);

// স্কিমা টেবিলগুলো তৈরি করো
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// পুরোনো ডেটাবেজে নতুন কলামগুলো যোগ করো (মাইগ্রেশন)
const remedyCols = db.prepare('PRAGMA table_info(remedies)').all().map((c) => c.name);
for (const col of ['clinical', 'better', 'worse']) {
  if (!remedyCols.includes(col)) db.exec(`ALTER TABLE remedies ADD COLUMN ${col} TEXT`);
}
if (!remedyCols.includes('is_custom')) {
  db.exec('ALTER TABLE remedies ADD COLUMN is_custom INTEGER DEFAULT 0');
}

export default db;

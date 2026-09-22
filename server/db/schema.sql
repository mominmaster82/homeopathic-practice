-- হোমিওপ্যাথিক সফটওয়্যার ডেটাবেজ স্কিমা

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  symptoms TEXT,
  notes TEXT,
  date TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS remedies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source TEXT,
  keynotes TEXT,
  clinical TEXT,
  better TEXT,
  worse TEXT
);

CREATE TABLE IF NOT EXISTS rubrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  rubric_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rubric_remedies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rubric_id INTEGER NOT NULL,
  remedy_id INTEGER NOT NULL,
  grade INTEGER DEFAULT 1,
  FOREIGN KEY (rubric_id) REFERENCES rubrics(id),
  FOREIGN KEY (remedy_id) REFERENCES remedies(id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  remedy_id INTEGER NOT NULL,
  potency TEXT,
  dose TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (remedy_id) REFERENCES remedies(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

import express from 'express';
import cors from 'cors';
import './db/index.js'; // ডেটাবেজ ও টেবিল তৈরি নিশ্চিত করে

import patients from './routes/patients.js';
import remedies from './routes/remedies.js';
import rubrics from './routes/rubrics.js';
import analysis from './routes/analysis.js';
import cases from './routes/cases.js';
import settings from './routes/settings.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/patients', patients);
app.use('/api/remedies', remedies);
app.use('/api/rubrics', rubrics);
app.use('/api/analysis', analysis);
app.use('/api/cases', cases);
app.use('/api/settings', settings);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`সার্ভার চলছে: http://localhost:${PORT}`);
});

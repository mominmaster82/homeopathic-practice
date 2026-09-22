import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'homeopathy-secret-key-change-in-production';

export function verifyToken(req, res, next) {
  // Authorization header থেকে টোকেন নাও
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'অথেনটিকেশন টোকেন নেই' });
  }

  const token = authHeader.substring(7); // 'Bearer ' এর পরের অংশ

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // ডিকোডেড ইউজার ইনফো রিকোয়েস্টে যোগ
    next();
  } catch (err) {
    return res.status(401).json({ error: 'অবৈধ বা মেয়াদোত্তীর্ণ টোকেন' });
  }
}

export { JWT_SECRET };

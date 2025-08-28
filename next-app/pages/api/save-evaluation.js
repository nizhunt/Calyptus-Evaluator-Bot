import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { evaluation } = req.body;
    const id = randomUUID();
    await kv.set(`evaluation:${id}`, evaluation);
    res.status(200).json({ id });
  } else if (req.method === 'GET') {
    const { id } = req.query;
    const evaluation = await kv.get(`evaluation:${id}`);
    if (evaluation) {
      res.status(200).json({ evaluation });
    } else {
      res.status(404).json({ error: 'Evaluation not found' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
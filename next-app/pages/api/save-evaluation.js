import { put, list } from '@vercel/blob';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { evaluation } = req.body;
      const id = randomUUID();
      const blob = await put(`evaluations/${id}.json`, evaluation, { access: 'public' });
      res.status(200).json({ id });
    } else if (req.method === 'GET') {
      const { id } = req.query;
      const { blobs } = await list({ prefix: `evaluations/${id}.json` });
      if (blobs.length > 0) {
        const response = await fetch(blobs[0].url);
        const evalStr = await response.text();
        res.status(200).json({ evaluation: evalStr });
      } else {
        res.status(404).json({ error: 'Evaluation not found' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}
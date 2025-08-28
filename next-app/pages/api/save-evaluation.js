import { createClient } from 'redis';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  const isDeployed = !!process.env.VERCEL_URL;
  let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  if (isDeployed && redisUrl.startsWith('redis://')) {
    redisUrl = redisUrl.replace('redis://', 'rediss://');
  }
  const client = createClient({ url: redisUrl });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();

  try {
    if (req.method === 'POST') {
      const { evaluation } = req.body;
      const id = randomUUID();
      await client.set(`evaluation:${id}`, JSON.stringify(evaluation));
      res.status(200).json({ id });
    } else if (req.method === 'GET') {
      const { id } = req.query;
      const evalStr = await client.get(`evaluation:${id}`);
      if (evalStr) {
        res.status(200).json({ evaluation: JSON.parse(evalStr) });
      } else {
        res.status(404).json({ error: 'Evaluation not found' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.disconnect();
  }
}
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const dataPath = path.join(process.cwd(), 'data', 'evaluations.json');

if (!fs.existsSync(path.dirname(dataPath))) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
}

if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, JSON.stringify([]));
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { evaluation } = req.body;
    const id = randomUUID();
    const evaluations = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    evaluations.push({ id, evaluation });
    fs.writeFileSync(dataPath, JSON.stringify(evaluations));
    res.status(200).json({ id });
  } else if (req.method === 'GET') {
    const { id } = req.query;
    const evaluations = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const evalItem = evaluations.find(e => e.id === id);
    if (evalItem) {
      res.status(200).json({ evaluation: evalItem.evaluation });
    } else {
      res.status(404).json({ error: 'Evaluation not found' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
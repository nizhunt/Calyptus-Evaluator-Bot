export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  const apifyToken = process.env.APIFY_TOKEN;

  if (!url || !apifyToken) {
    return res.status(400).json({ error: 'Missing URL or Apify token' });
  }

  try {
    // Run the Apify actor
    const runResponse = await fetch(`https://api.apify.com/v2/acts/webtotheflow~get-loom-transcript/runs?token=${apifyToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls: [{ url }] }),
    });

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Poll for completion
    let statusResponse;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes if polling every 10s
    while (attempts < maxAttempts) {
      statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const statusData = await statusResponse.json();
      if (statusData.data.status !== 'RUNNING') {
        if (statusData.data.status === 'SUCCEEDED') {
          break;
        } else {
          throw new Error('Actor run failed');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Timeout waiting for actor to complete');
    }

    // Get dataset items
    const datasetId = statusResponse.data.defaultDatasetId;
    const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    const items = await itemsResponse.json();

    // Extract transcript (assuming items[0] has transcript field or similar)
    const transcript = items.map(item => item.text).join('\n'); // Adjust based on actual structure

    res.status(200).json({ transcript });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching transcript' });
  }
}
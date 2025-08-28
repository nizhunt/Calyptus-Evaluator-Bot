import { randomUUID } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { assessmentQuestion, message } = req.body;
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  try {
    const sessionId = randomUUID();
    const payload = {
      text: message,
      task: assessmentQuestion,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const botResponse =
      data.response || data.message || data.text || "No response received";

    res.status(200).json({ response: botResponse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error generating response" });
  }
}

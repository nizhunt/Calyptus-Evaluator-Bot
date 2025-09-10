// Simple JWT implementation without external dependencies
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Base64 URL encode/decode functions
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  str += '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

// Simple HMAC SHA256 signature
function createSignature(data, secret) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Verify JWT token
function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [header, payload, signature] = parts;
    const expectedSignature = createSignature(`${header}.${payload}`, secret);
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    
    // Check expiration
    if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
      throw new Error('Token expired');
    }

    return decodedPayload;
  } catch (error) {
    throw new Error('Invalid token: ' + error.message);
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const decoded = verifyToken(token, JWT_SECRET);
    
    // Return the decoded token data
    res.status(200).json({
      employerName: decoded.employerName,
      question: decoded.question,
      createdAt: decoded.iat,
      expiresAt: decoded.exp
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { password } = req.body;
  const correctPassword = process.env.SITE_PASSWORD || 'changeme123';
  
  if (password === correctPassword) {
    // Create a secure token
    const authToken = process.env.AUTH_SECRET || 'default-secret-change-me';
    
    // Set cookie with auth token (30 days expiry)
    res.setHeader(
      'Set-Cookie',
      `auth-token=${authToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
    );
    
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ error: 'Invalid password' });
  }
}

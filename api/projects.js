import { neon } from '@neondatabase/serverless';

function getSQL() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('No DATABASE_URL or POSTGRES_URL env var found');
  return neon(url);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled',
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_by TEXT
    )
  `;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = getSQL();
    await ensureTable(sql);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, data, updated_at, updated_by 
        FROM projects 
        ORDER BY updated_at DESC
      `;
      return res.json(rows);
    }

    if (req.method === 'PUT') {
      const { projects } = req.body;
      if (!Array.isArray(projects)) {
        return res.status(400).json({ error: 'Expected { projects: [...] }' });
      }

      for (const p of projects) {
        const dataJson = JSON.stringify(p);
        await sql`
          INSERT INTO projects (id, name, data, updated_at, updated_by)
          VALUES (${p.id}, ${p.name || 'Untitled'}, ${dataJson}::jsonb, NOW(), ${p.updated_by || null})
          ON CONFLICT (id) DO UPDATE SET
            name = ${p.name || 'Untitled'},
            data = ${dataJson}::jsonb,
            updated_at = NOW(),
            updated_by = ${p.updated_by || null}
        `;
      }
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM projects WHERE id = ${id}`;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('DB error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
}

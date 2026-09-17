const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-admin-key,authorization,apikey',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function env() {
  return {
    url: Deno.env.get('SUPABASE_URL')!,
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  };
}

async function getAdminHash() {
  const { url, service } = env();
  const r = await fetch(`${url}/rest/v1/site_admin_security?id=eq.primary&select=key_hash`, {
    headers: { Authorization: `Bearer ${service}`, apikey: service },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Could not read admin security state: ${r.status}`);
  const rows = await r.json();
  const hash = rows?.[0]?.key_hash;
  if (!hash) throw new Error('Admin security state is missing');
  return hash as string;
}

async function authorized(key: string) {
  if (!key) return false;
  return (await sha256Hex(key)) === (await getAdminHash());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const key = req.headers.get('x-admin-key') || '';
    if (!(await authorized(key))) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));

    if (body?.action === 'ping') return json({ ok: true });

    if (body?.action === 'change_key') {
      const newKey = typeof body?.newKey === 'string' ? body.newKey : '';
      if (newKey.length < 8 || newKey.length > 128) {
        return json({ error: 'New admin key must be 8–128 characters.' }, 400);
      }
      if (newKey === key) return json({ error: 'Choose a different admin key.' }, 400);

      const newHash = await sha256Hex(newKey);
      const { url, service } = env();
      const r = await fetch(`${url}/rest/v1/site_admin_security?id=eq.primary`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${service}`,
          apikey: service,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ key_hash: newHash, updated_at: new Date().toISOString() }),
      });
      const text = await r.text();
      if (!r.ok) throw new Error(text || `Admin key update failed: ${r.status}`);
      return json({ ok: true, changed: true });
    }

    if (body?.action !== 'publish' || !body?.data || typeof body.data !== 'object') {
      return json({ error: 'Invalid payload' }, 400);
    }

    const { url, service } = env();
    const r = await fetch(`${url}/rest/v1/site_state?id=eq.live`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${service}`,
        apikey: service,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ data: body.data, updated_at: new Date().toISOString() }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text || `Database update failed: ${r.status}`);
    return json({ ok: true, row: text ? JSON.parse(text) : null });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
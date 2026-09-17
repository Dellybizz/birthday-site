const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-admin-key,authorization,apikey',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'file';
}

async function getAdminHash() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

async function authorized(req: Request) {
  const key = req.headers.get('x-admin-key') || '';
  return !!key && (await sha256Hex(key)) === (await getAdminHash());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!(await authorized(req))) return json({ error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (req.method === 'GET') {
      const incoming = new URL(req.url);
      const folder = safeName(incoming.searchParams.get('folder') || 'birthday-site');
      const list = await fetch(`${url}/storage/v1/object/list/birthday-media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${service}`,
          apikey: service,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: folder,
          limit: 1000,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        }),
      });
      const items = await list.json().catch(() => []);
      if (!list.ok) throw new Error(items?.message || `Could not list media: ${list.status}`);
      const mapped = (Array.isArray(items) ? items : []).filter((item: any) => item?.name).map((item: any) => {
        const path = `${folder}/${item.name}`;
        return {
          name: item.name,
          path,
          url: `${url}/storage/v1/object/public/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`,
          type: item.metadata?.mimetype || item.metadata?.['mimetype'] || '',
          size: Number(item.metadata?.size || 0),
          createdAt: item.created_at || item.updated_at || null,
        };
      });
      return json({ ok: true, items: mapped });
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'Missing file' }, 400);
    if (file.size <= 0) return json({ error: 'The selected file is empty' }, 400);
    if (file.size > 100 * 1024 * 1024) return json({ error: 'File too large. Maximum size is 100 MB.' }, 413);

    const folder = safeName(String(form.get('folder') || 'birthday-site'));
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
    const path = `${folder}/${name}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = await fetch(`${url}/storage/v1/object/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${service}`,
        apikey: service,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: bytes,
    });
    const responseText = await upload.text();
    if (!upload.ok) {
      let detail = responseText;
      try { detail = JSON.parse(responseText)?.message || responseText; } catch {}
      throw new Error(detail || `Upload failed: ${upload.status}`);
    }
    const publicUrl = `${url}/storage/v1/object/public/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`;
    return json({ ok: true, path, url: publicUrl, type: file.type, size: file.size, name: file.name });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
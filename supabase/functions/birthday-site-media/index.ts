const ALLOWED_ORIGINS = new Set([
  'https://birthday-site-zhlw.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const MIME_BY_EXT: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  mp4: ['video/mp4'],
  webm: ['video/webm'],
  mp3: ['audio/mpeg'],
  m4a: ['audio/mp4','audio/x-m4a'],
  wav: ['audio/wav','audio/x-wav'],
};

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = !origin || ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'content-type,x-admin-key,authorization,apikey',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  };
}

function originAllowed(req: Request) {
  const origin = req.headers.get('origin') || '';
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function env() {
  return {
    url: Deno.env.get('SUPABASE_URL')!,
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  };
}

function json(req: Request, body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      ...extra,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function clientFingerprint(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
  return await sha256Hex(forwarded);
}

async function authorize(req: Request) {
  const key = req.headers.get('x-admin-key') || '';
  if (!key) return { allowed: false, rate_limited: false };
  const { url, service } = env();
  const r = await fetch(`${url}/rest/v1/rpc/birthday_admin_authorize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${service}`,
      apikey: service,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_key: key,
      p_fingerprint: await clientFingerprint(req),
    }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(result?.message || result?.error || `Admin authorization failed: ${r.status}`);
  return result || { allowed: false, rate_limited: false };
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'file';
}

function extOf(name: string) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function bytesStart(bytes: Uint8Array, values: number[]) {
  return values.every((v, i) => bytes[i] === v);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return new TextDecoder().decode(bytes.slice(start, end));
}

function signatureMatches(ext: string, bytes: Uint8Array) {
  if (ext === 'jpg' || ext === 'jpeg') return bytesStart(bytes, [0xff,0xd8,0xff]);
  if (ext === 'png') return bytesStart(bytes, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (ext === 'gif') return ascii(bytes,0,6) === 'GIF87a' || ascii(bytes,0,6) === 'GIF89a';
  if (ext === 'webp') return ascii(bytes,0,4) === 'RIFF' && ascii(bytes,8,12) === 'WEBP';
  if (ext === 'webm') return bytesStart(bytes, [0x1a,0x45,0xdf,0xa3]);
  if (ext === 'wav') return ascii(bytes,0,4) === 'RIFF' && ascii(bytes,8,12) === 'WAVE';
  if (ext === 'mp3') {
    if (ascii(bytes,0,3) === 'ID3') return true;
    return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  }
  if (ext === 'mp4' || ext === 'm4a') return bytes.length >= 12 && ascii(bytes,4,8) === 'ftyp';
  return false;
}

function validateFile(file: File, bytes: Uint8Array) {
  const ext = extOf(file.name);
  const allowedMimes = MIME_BY_EXT[ext];
  if (!allowedMimes) return `Unsupported file extension .${ext || '(none)'}.`;
  if (!allowedMimes.includes(file.type)) return `File type ${file.type || '(missing)'} does not match .${ext}.`;
  if (!signatureMatches(ext, bytes.slice(0, 32))) return 'File contents do not match the declared file type.';
  return '';
}

async function referenceStatus(urlValue: string, path: string) {
  const { url, service } = env();
  const r = await fetch(`${url}/rest/v1/rpc/birthday_media_reference_status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${service}`,
      apikey: service,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_url: urlValue, p_path: path }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(result?.message || result?.error || `Reference scan failed: ${r.status}`);
  return result || { referenced: false, live: false, history_count: 0 };
}

Deno.serve(async (req: Request) => {
  if (!originAllowed(req)) return json(req, { error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    const auth = await authorize(req);
    if (auth?.rate_limited) {
      const retry = Math.max(1, Number(auth.retry_after || 900));
      return json(req, { error: 'Too many failed admin-key attempts. Try again later.', code: 'RATE_LIMITED', retryAfter: retry }, 429, { 'Retry-After': String(retry) });
    }
    if (!auth?.allowed) return json(req, { error: 'Unauthorized' }, 401);

    const { url, service } = env();

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

      const mapped = [];
      for (const item of (Array.isArray(items) ? items : []).filter((x: any) => x?.name)) {
        const path = `${folder}/${item.name}`;
        const publicUrl = `${url}/storage/v1/object/public/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`;
        const refs = await referenceStatus(publicUrl, path);
        mapped.push({
          name: item.name,
          path,
          url: publicUrl,
          type: item.metadata?.mimetype || item.metadata?.['mimetype'] || '',
          size: Number(item.metadata?.size || 0),
          createdAt: item.created_at || item.updated_at || null,
          referenced: !!refs?.referenced,
          referencedLive: !!refs?.live,
          historyReferences: Number(refs?.history_count || 0),
          orphaned: !refs?.referenced,
        });
      }
      return json(req, { ok: true, items: mapped });
    }

    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => ({}));
      const path = String(body?.path || '');
      if (!path.startsWith('birthday-site/') || path.includes('..')) return json(req, { error: 'Invalid media path.' }, 400);

      const publicUrl = `${url}/storage/v1/object/public/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`;
      const refs = await referenceStatus(publicUrl, path);
      if (refs?.referenced) {
        return json(req, {
          error: 'This upload is still referenced by live state or history and cannot be deleted.',
          code: 'MEDIA_REFERENCED',
          referencedLive: !!refs.live,
          historyReferences: Number(refs.history_count || 0),
        }, 409);
      }

      const del = await fetch(`${url}/storage/v1/object/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${service}`,
          apikey: service,
        },
      });
      const detail = await del.text();
      if (!del.ok) throw new Error(detail || `Delete failed: ${del.status}`);
      return json(req, { ok: true, deleted: path });
    }

    if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json(req, { error: 'Missing file' }, 400);
    if (file.size <= 0) return json(req, { error: 'The selected file is empty' }, 400);
    if (file.size > 100 * 1024 * 1024) return json(req, { error: 'File too large. Maximum size is 100 MB.' }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validationError = validateFile(file, bytes);
    if (validationError) return json(req, { error: validationError, code: 'INVALID_MEDIA' }, 415);

    const folder = safeName(String(form.get('folder') || 'birthday-site'));
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
    const path = `${folder}/${name}`;
    const upload = await fetch(`${url}/storage/v1/object/birthday-media/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${service}`,
        apikey: service,
        'Content-Type': file.type,
        'x-upsert': 'false',
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
    return json(req, { ok: true, path, url: publicUrl, type: file.type, size: file.size, name: file.name, orphaned: true });
  } catch (err) {
    return json(req, { error: String((err as Error)?.message || err) }, 500);
  }
});

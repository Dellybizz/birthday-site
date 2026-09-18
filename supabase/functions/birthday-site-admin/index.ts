const ALLOWED_ORIGINS = new Set([
  'https://birthday-site-zhlw.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = !origin || ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'content-type,x-admin-key,authorization,apikey',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}

function originAllowed(req: Request) {
  const origin = req.headers.get('origin') || '';
  return !origin || ALLOWED_ORIGINS.has(origin);
}

const ALLOWED_PAGES = new Set([
  'countdown.html',
  'index.html',
  'memories.html',
  'pretty-photos.html',
  'heart.html',
  'yapping.html',
  'fair.html',
  'finale.html',
]);
const FAIR_IDS = new Set(['smile','presence','laugh','care','yapping','excitement','comfort','you']);
const TOP_LEVEL_KEYS = new Set(['general','pageOrder','pageEnabled','fairItems','fairPhotos','patches','pageCss','pages']);
const GENERAL_KEYS = new Set([
  'name','nickname','insideJoke','introLine','birthdayISO','previewCountdownHours',
  'favoritePhoto','musicFile','soundDefault','motionScale','globalCss','soundtrack'
]);
const GENERATED_SELECTOR = /(bday-added-media|bday-added-photo|data-bday-inserted|data-bday-group)/i;

function env() {
  return {
    url: Deno.env.get('SUPABASE_URL')!,
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  };
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

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max;
}

function validateStringMap(value: unknown, maxValue = 100000) {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([k,v]) => k.length <= 160 && str(v,maxValue));
}

function validateState(data: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(data)) return ['State must be a JSON object.'];

  let encoded = 0;
  try { encoded = new TextEncoder().encode(JSON.stringify(data)).byteLength; }
  catch { return ['State could not be serialized.']; }
  if (encoded > 1024 * 1024) errors.push('State exceeds the 1 MB safety limit.');

  for (const key of Object.keys(data)) {
    if (!TOP_LEVEL_KEYS.has(key)) errors.push(`Unknown top-level key: ${key}`);
  }

  if (!isRecord(data.general)) errors.push('general must be an object.');
  else {
    for (const key of Object.keys(data.general)) {
      if (!GENERAL_KEYS.has(key)) errors.push(`Unknown general setting: ${key}`);
    }
    const g = data.general;
    for (const key of ['name','nickname','insideJoke','introLine','favoritePhoto','musicFile','globalCss']) {
      if (g[key] !== undefined && !str(g[key], key === 'globalCss' ? 100000 : 20000)) errors.push(`general.${key} must be a string.`);
    }
    if (g.birthdayISO !== undefined && (!str(g.birthdayISO,128) || Number.isNaN(Date.parse(g.birthdayISO)))) errors.push('general.birthdayISO is invalid.');
    if (g.previewCountdownHours !== undefined && (typeof g.previewCountdownHours !== 'number' || !Number.isFinite(g.previewCountdownHours) || g.previewCountdownHours < 0 || g.previewCountdownHours > 8760)) errors.push('general.previewCountdownHours is invalid.');
    if (g.motionScale !== undefined && (typeof g.motionScale !== 'number' || !Number.isFinite(g.motionScale) || g.motionScale < 0 || g.motionScale > 5)) errors.push('general.motionScale is invalid.');
    if (g.soundDefault !== undefined && typeof g.soundDefault !== 'boolean') errors.push('general.soundDefault must be boolean.');
    if (g.soundtrack !== undefined) {
      const s = g.soundtrack;
      if (!isRecord(s)) errors.push('general.soundtrack must be an object.');
      else {
        const validateTracks = (value: unknown, at: string) => {
          if (!Array.isArray(value) || value.length > 50) { errors.push(`${at} must be an array with at most 50 tracks.`); return; }
          value.forEach((track:any,index:number)=>{
            const where=`${at}[${index}]`;
            if (!isRecord(track)) { errors.push(`${where} must be an object.`); return; }
            if (!str(track.url,4096) || !track.url.trim()) errors.push(`${where}.url is invalid.`);
            if (track.name !== undefined && !str(track.name,500)) errors.push(`${where}.name is invalid.`);
          });
        };
        validateTracks(s.defaultTracks ?? [], 'general.soundtrack.defaultTracks');
        if (s.shuffle !== undefined && typeof s.shuffle !== 'boolean') errors.push('general.soundtrack.shuffle must be boolean.');
        if (s.pageTracks !== undefined) {
          if (!isRecord(s.pageTracks)) errors.push('general.soundtrack.pageTracks must be an object.');
          else for (const [page,tracks] of Object.entries(s.pageTracks)) {
            if (!ALLOWED_PAGES.has(page)) errors.push(`Unknown soundtrack page: ${page}`);
            validateTracks(tracks,`general.soundtrack.pageTracks.${page}`);
          }
        }
      }
    }
  }

  if (!Array.isArray(data.pageOrder)) errors.push('pageOrder must be an array.');
  else {
    const order = data.pageOrder;
    if (order.length !== ALLOWED_PAGES.size) errors.push('pageOrder must contain all eight public pages.');
    if (new Set(order).size !== order.length) errors.push('pageOrder contains duplicates.');
    for (const page of order) if (!ALLOWED_PAGES.has(page)) errors.push(`Unknown page in pageOrder: ${String(page)}`);
    for (const page of ALLOWED_PAGES) if (!order.includes(page)) errors.push(`Missing page in pageOrder: ${page}`);
    if (order[0] !== 'countdown.html') errors.push('Countdown must remain the first journey page.');
    if (order[1] !== 'index.html') errors.push('Entry must remain the first unlocked chapter.');
    if (order[order.length - 1] !== 'finale.html') errors.push('Finale must remain the last journey page.');
  }

  if (!isRecord(data.pageEnabled)) errors.push('pageEnabled must be an object.');
  else {
    for (const [page,value] of Object.entries(data.pageEnabled)) {
      if (!ALLOWED_PAGES.has(page)) errors.push(`Unknown pageEnabled page: ${page}`);
      if (typeof value !== 'boolean') errors.push(`pageEnabled.${page} must be boolean.`);
    }
    for (const page of ['countdown.html','index.html','finale.html']) {
      if (data.pageEnabled[page] !== true) errors.push(`${page} is a required journey page and must stay enabled.`);
    }
  }

  if (!isRecord(data.pageCss)) errors.push('pageCss must be an object.');
  else {
    for (const [page,value] of Object.entries(data.pageCss)) {
      if (!ALLOWED_PAGES.has(page)) errors.push(`Unknown pageCss page: ${page}`);
      if (!str(value,100000)) errors.push(`pageCss.${page} must be a string.`);
    }
  }

  if (!isRecord(data.pages)) errors.push('pages must be an object.');
  else {
    if (new TextEncoder().encode(JSON.stringify(data.pages)).byteLength > 300000) errors.push('pages data is too large.');
    const heart = data.pages.heart;
    if (heart !== undefined) {
      if (!isRecord(heart) || !Array.isArray(heart.memories) || heart.memories.length !== 20) errors.push('pages.heart.memories must contain exactly 20 memories.');
      else heart.memories.forEach((item:any,index:number)=>{
        const at=`pages.heart.memories[${index}]`;
        if(!isRecord(item)){errors.push(`${at} must be an object.`);return}
        if(!str(item.title,500)||!str(item.note,5000))errors.push(`${at} title/note is invalid.`);
        if(item.mediaUrl!==undefined&&!str(item.mediaUrl,4096))errors.push(`${at}.mediaUrl must be a string.`);
        if(item.mediaType!==undefined&&!['image','video','audio'].includes(item.mediaType))errors.push(`${at}.mediaType is invalid.`);
      });
    }
    const yapping = data.pages.yapping;
    if (yapping !== undefined) {
      if (!isRecord(yapping) || !Array.isArray(yapping.clips) || yapping.clips.length > 50) errors.push('pages.yapping.clips must contain between 0 and 50 clips.');
      else yapping.clips.forEach((item:any,index:number)=>{
        const at=`pages.yapping.clips[${index}]`;
        if(!isRecord(item)){errors.push(`${at} must be an object.`);return}
        if(!str(item.title,500)||!str(item.note,5000))errors.push(`${at} title/note is invalid.`);
        if(item.src!==undefined&&!str(item.src,4096))errors.push(`${at}.src must be a string.`);
        if(item.mediaType!==undefined&&!['video','audio'].includes(item.mediaType))errors.push(`${at}.mediaType is invalid.`);
      });
    }
  }

  if (!isRecord(data.fairItems)) errors.push('fairItems must be an object.');
  else {
    for (const [id,item] of Object.entries(data.fairItems)) {
      if (!FAIR_IDS.has(id)) errors.push(`Unknown fair item: ${id}`);
      if (!isRecord(item)) { errors.push(`fairItems.${id} must be an object.`); continue; }
      for (const [key,value] of Object.entries(item)) if (!str(value,20000)) errors.push(`fairItems.${id}.${key} must be a string.`);
    }
  }

  if (!isRecord(data.fairPhotos)) errors.push('fairPhotos must be an object.');
  else {
    for (const [id,photos] of Object.entries(data.fairPhotos)) {
      if (!FAIR_IDS.has(id)) errors.push(`Unknown fairPhotos item: ${id}`);
      if (!validateStringMap(photos,4096)) errors.push(`fairPhotos.${id} must contain string URLs.`);
    }
  }

  if (!isRecord(data.patches)) errors.push('patches must be an object.');
  else {
    let totalPatches = 0;
    for (const [page,patches] of Object.entries(data.patches)) {
      if (!ALLOWED_PAGES.has(page)) errors.push(`Unknown patches page: ${page}`);
      if (!Array.isArray(patches)) { errors.push(`patches.${page} must be an array.`); continue; }
      if (patches.length > 500) errors.push(`patches.${page} exceeds 500 patches.`);
      totalPatches += patches.length;

      patches.forEach((patch:any,index:number) => {
        const at = `patches.${page}[${index}]`;
        if (!isRecord(patch)) { errors.push(`${at} must be an object.`); return; }
        if (!str(patch.selector,1500) || !patch.selector.trim()) { errors.push(`${at}.selector is invalid.`); return; }
        if (GENERATED_SELECTOR.test(patch.selector)) errors.push(`${at}.selector targets generated runtime media.`);

        if (patch.text !== undefined && !str(patch.text,100000)) errors.push(`${at}.text must be a string.`);
        if (patch.src !== undefined && !str(patch.src,4096)) errors.push(`${at}.src must be a string.`);
        if (patch.href !== undefined && !str(patch.href,4096)) errors.push(`${at}.href must be a string.`);
        if (patch.hidden !== undefined && typeof patch.hidden !== 'boolean') errors.push(`${at}.hidden must be boolean.`);

        if (patch.styles !== undefined) {
          if (!isRecord(patch.styles) || Object.keys(patch.styles).length > 60) errors.push(`${at}.styles is invalid.`);
          else for (const [key,value] of Object.entries(patch.styles)) {
            if (!str(key,120) || !(value === null || typeof value === 'string' || typeof value === 'number')) errors.push(`${at}.styles contains an invalid value.`);
          }
        }

        for (const listKey of ['insertImages','insertMedia']) {
          const list = patch[listKey];
          if (list === undefined) continue;
          if (!Array.isArray(list) || list.length > 50) { errors.push(`${at}.${listKey} is invalid.`); continue; }
          const last = patch.selector.split('>').pop()?.trim() || patch.selector.trim();
          if (list.length && /^(?:html|body|main|section|article)(?:\b|[.#:\[])/i.test(last)) errors.push(`${at} cannot attach media to a broad structural container.`);
          list.forEach((item:any,mediaIndex:number) => {
            const mt = `${at}.${listKey}[${mediaIndex}]`;
            if (!isRecord(item)) { errors.push(`${mt} must be an object.`); return; }
            if (!str(item.url,4096) || !item.url) errors.push(`${mt}.url is invalid.`);
            if (item.id !== undefined && !str(item.id,300)) errors.push(`${mt}.id is invalid.`);
            if (item.type !== undefined && !str(item.type,200)) errors.push(`${mt}.type is invalid.`);
            if (item.name !== undefined && !str(item.name,500)) errors.push(`${mt}.name is invalid.`);
            if (item.alt !== undefined && !str(item.alt,2000)) errors.push(`${mt}.alt is invalid.`);
            if (item.placement !== undefined && !['replace','inside','before','after'].includes(item.placement)) errors.push(`${mt}.placement is invalid.`);
          });
        }
      });
    }
    if (totalPatches > 2000) errors.push('Total patch count exceeds 2000.');
  }

  return [...new Set(errors)].slice(0,50);
}

Deno.serve(async (req: Request) => {
  if (!originAllowed(req)) return json(req, { error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    const key = req.headers.get('x-admin-key') || '';
    const auth = await authorize(req);
    if (auth?.rate_limited) {
      const retry = Math.max(1, Number(auth.retry_after || 900));
      return json(req, { error: 'Too many failed admin-key attempts. Try again later.', code: 'RATE_LIMITED', retryAfter: retry }, 429, { 'Retry-After': String(retry) });
    }
    if (!auth?.allowed) return json(req, { error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));

    if (body?.action === 'ping') return json(req, { ok: true });

    if (body?.action === 'change_key') {
      const newKey = typeof body?.newKey === 'string' ? body.newKey : '';
      if (newKey.length < 8 || newKey.length > 128) return json(req, { error: 'New admin key must be 8–128 characters.' }, 400);
      if (newKey === key) return json(req, { error: 'Choose a different admin key.' }, 400);

      const { url, service } = env();
      const r = await fetch(`${url}/rest/v1/rpc/birthday_admin_change_key`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${service}`,
          apikey: service,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_new_key: newKey }),
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok || !result?.ok) throw new Error(result?.message || result?.error || `Admin key update failed: ${r.status}`);
      return json(req, { ok: true, changed: true, hashScheme: result.hash_scheme || 'bcrypt-sha256' });
    }

    if (body?.action !== 'publish' || !body?.data || typeof body.data !== 'object') return json(req, { error: 'Invalid payload' }, 400);

    const expectedRevision = Number(body?.expectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      return json(req, { error: 'A valid state revision is required.', code: 'MISSING_REVISION' }, 409);
    }

    const validationErrors = validateState(body.data);
    if (validationErrors.length) {
      return json(req, { error: 'State validation failed.', code: 'INVALID_STATE', details: validationErrors }, 400);
    }

    const { url, service } = env();
    const rpc = await fetch(`${url}/rest/v1/rpc/publish_site_state`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${service}`,
        apikey: service,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_expected_revision: expectedRevision, p_data: body.data }),
    });
    const result = await rpc.json().catch(() => ({}));
    if (!rpc.ok) throw new Error(result?.message || result?.error || `State publish failed: ${rpc.status}`);

    if (result?.conflict || result?.error === 'STALE_STATE') {
      return json(req, {
        error: 'This Control Room tab is out of date.',
        code: 'STALE_STATE',
        currentRevision: result?.current_revision ?? null,
        updatedAt: result?.updated_at ?? null,
      }, 409);
    }
    if (!result?.ok) return json(req, { error: result?.error || 'State publish failed.', code: result?.error || 'PUBLISH_FAILED' }, 400);

    return json(req, { ok: true, revision: result.revision, updatedAt: result.updated_at });
  } catch (err) {
    return json(req, { error: String((err as Error)?.message || err) }, 500);
  }
});
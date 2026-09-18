const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

Deno.serve((_req: Request) => {
  return new Response(JSON.stringify({
    error: 'Retired endpoint',
    code: 'STATIC_PUBLISH_RETIRED',
    message: 'GitHub/Render is the canonical static source. This legacy publisher no longer accepts writes.',
  }), { status: 410, headers });
});

/** Teruskan request ke Supabase Edge Function agar bisa dipanggil lewat domain sendiri
 *  (mis. https://tools.arexans.my.id/api/get-script?name=keysystem). */
const SUPABASE_URL =
  process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'] || '';

const FORWARD_HEADERS = [
  'user-agent',
  'accept',
  'accept-language',
  'content-type',
  'x-requested-with',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'sec-ch-ua',
  'upgrade-insecure-requests',
];

export async function proxyEdgeFunction(fn: string, request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(`${SUPABASE_URL}/functions/v1/${fn}`);
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const headers = new Headers();
  for (const h of FORWARD_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }

  const upstream = await fetch(target.toString(), {
    method: request.method === 'HEAD' ? 'GET' : request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  const out = new Headers();
  const ct = upstream.headers.get('content-type');
  const loc = upstream.headers.get('location');
  if (ct) out.set('content-type', ct);
  if (loc) out.set('location', loc);
  out.set('cache-control', 'private, no-store, no-cache, max-age=0, must-revalidate');
  out.set('access-control-allow-origin', '*');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

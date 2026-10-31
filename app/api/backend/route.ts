import { LIVE_ORIGIN } from '@/lib/backend/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json'
};
const failure = (status: number, code: string, message: string) => Response.json({
  errors: [{
    message,
    extensions: {
      code
    }
  }]
}, {
  status,
  headers
});
export async function POST(request: Request) {
  // This proxy has one configured upstream; callers cannot choose a target URL.
  const upstream = process.env.LIVE_GRAPHQL_URL || `${LIVE_ORIGIN}/graphql`;
  let body: string;
  try {
    if (Number(request.headers.get('content-length')) > 65536) return failure(413, 'BAD_USER_INPUT', 'GraphQL request is too large.');
    body = await request.text();
    if (new TextEncoder().encode(body).length > 65536) return failure(413, 'BAD_USER_INPUT', 'GraphQL request is too large.');
    const value = JSON.parse(body);
    if (typeof value.query !== 'string' || Array.isArray(value)) return failure(400, 'BAD_USER_INPUT', 'Send a GraphQL operation.');
  } catch {
    return failure(400, 'BAD_USER_INPUT', 'Invalid GraphQL request.');
  }
  try {
    const authorization = request.headers.get('authorization');
    const result = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(authorization ? {
          Authorization: authorization
        } : {})
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20000)
    });
    const payload = await result.text();
    try {
      const parsed = JSON.parse(payload);
      if (!('data' in parsed) && !Array.isArray(parsed.errors)) throw Error();
    } catch {
      return failure(502, 'BAD_RESPONSE', 'The live backend returned a non-GraphQL response. Check that the tunnel is online.');
    }
    return new Response(payload, {
      status: result.status,
      headers
    });
  } catch {
    return failure(502, 'CONNECTION_FAILED', 'Cannot reach the live backend. The request was not retried; check the connection and refresh before repeating a payment.');
  }
}

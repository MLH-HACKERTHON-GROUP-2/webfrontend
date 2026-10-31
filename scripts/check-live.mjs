import { readFileSync } from 'node:fs';
import { getIntrospectionQuery, buildClientSchema, parse, validate } from 'graphql';
const origin = process.env.LIVE_GRAPHQL_URL || 'https://unstarched-maritally-ike.ngrok-free.dev/graphql';
const source = readFileSync(new URL('../lib/backend/live-operations.ts', import.meta.url), 'utf8');
const { liveOperations } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
async function request(query) {
  const response = await fetch(origin, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(20000) });
  const payload = await response.json();
  if (!response.ok || payload.errors) throw Error(payload.errors?.map(e => e.message).join('; ') || `HTTP ${response.status}`);
  return payload.data;
}
try {
  const health = await request(liveOperations.health);
  const contract = await request(getIntrospectionQuery());
  const schema = buildClientSchema(contract);
  let invalid = 0;
  for (const [name, document] of Object.entries(liveOperations)) {
    const errors = validate(schema, parse(document));
    if (errors.length) { invalid++; console.error(name + ': ' + errors.map(e => e.message).join('; ')); }
  }
  console.log(`Live endpoint: ${origin}`);
  console.log(`Health: ${health.health}`);
  console.log(`Documents: ${Object.keys(liveOperations).length - invalid}/${Object.keys(liveOperations).length} validate against the current live schema.`);
  const fields = schema.getMutationType()?.getFields() || {};
  console.log('Staff QR pairing: ' + (fields.createLoginQr ? 'exposed' : 'not exposed by backend'));
  console.log('Workspace scheduling/inventory: ' + (fields.workspaceAction ? 'exposed' : 'not exposed by backend'));
  console.log('Subscriptions: ' + (schema.getSubscriptionType() ? 'exposed' : 'not exposed; live UI uses polling'));
  if (invalid) process.exitCode = 1;
} catch (error) { console.error('Live backend check failed: ' + error.message); process.exitCode = 1; }

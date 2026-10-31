import { createServer } from 'node:http';
import { graphql, execute, subscribe, parse, validate, getOperationAST } from 'graphql';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { createSimulation, schema } from './engine.mjs';
const port = Number(process.env.MOCK_PORT || 4000);
const origins = new Set((process.env.MOCK_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(','));
const engine = createSimulation({
  seedWorkspace: true,
  scanOrigin: process.env.MOCK_SCAN_ORIGIN || 'http://localhost:3000'
});
const token = header => typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !origins.has(origin)) {
    response.writeHead(403).end('Origin not allowed');
    return;
  }
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  if (new URL(request.url, 'http://localhost').pathname !== '/graphql') {
    response.writeHead(404).end();
    return;
  }
  if (request.method === 'GET') {
    response.writeHead(200, {
      'Content-Type': 'text/plain'
    }).end('Emerald Care LOCAL SIMULATION. Send GraphQL operations with POST /graphql. State resets on restart.');
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405).end();
    return;
  }
  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 65536) {
        response.writeHead(413).end();
        return;
      }
    }
    const input = JSON.parse(body);
    if (typeof input.query !== 'string') throw new Error('Expected a GraphQL query string.');
    const result = await graphql({
      schema,
      source: input.query,
      variableValues: input.variables,
      operationName: input.operationName,
      rootValue: engine.root,
      contextValue: {
        accessToken: token(request.headers.authorization)
      },
      fieldResolver: engine.fieldResolver
    });
    response.writeHead(200, {
      'Content-Type': 'application/json'
    }).end(JSON.stringify(result));
  } catch {
    response.writeHead(400, {
      'Content-Type': 'application/json'
    }).end(JSON.stringify({
      errors: [{
        message: 'Invalid GraphQL request.',
        extensions: {
          code: 'BAD_USER_INPUT'
        }
      }]
    }));
  }
});
const sockets = new WebSocketServer({
  noServer: true
});
server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/graphql' || request.headers.origin && !origins.has(request.headers.origin)) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request));
});
const cleanup = useServer({
  onConnect(context) {
    const auth = {
      accessToken: token(context.connectionParams?.authorization)
    };
    try {
      engine.requireRole(auth, 'PATIENT', 'DOCTOR', 'PHARMACY', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN');
    } catch {
      return false;
    }
    context.extra.expiryCheck = setInterval(() => {
      try {
        engine.requireRole(auth, 'PATIENT', 'DOCTOR', 'PHARMACY', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN');
      } catch {
        context.extra.socket.close(4403, 'Access token expired');
      }
    }, 1000);
  },
  onClose(context) {
    clearInterval(context.extra.expiryCheck);
  },
  onSubscribe(context, id, payload) {
    const document = parse(payload.query);
    const errors = validate(schema, document);
    if (errors.length) return errors;
    if (getOperationAST(document, payload.operationName)?.operation !== 'subscription') throw new Error('Use HTTP for queries and mutations.');
    return {
      schema,
      document,
      operationName: payload.operationName,
      variableValues: payload.variables,
      rootValue: engine.root,
      contextValue: {
        accessToken: token(context.connectionParams?.authorization)
      }
    };
  },
  execute: args => execute({
    ...args,
    fieldResolver: engine.fieldResolver
  }),
  subscribe: args => subscribe({
    ...args,
    fieldResolver: engine.fieldResolver,
    subscribeFieldResolver: engine.fieldResolver
  })
}, sockets);
server.listen(port, process.env.MOCK_HOST || '127.0.0.1', () => console.log(`LOCAL SIMULATION: http://localhost:${port}/graphql (HTTP + graphql-ws). All accounts use OTP 000000. No real payments or patient data.`));
server.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  await cleanup.dispose();
  server.close(() => process.exit(0));
});

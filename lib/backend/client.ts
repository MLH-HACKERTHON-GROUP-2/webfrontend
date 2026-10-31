import { createClient } from 'graphql-ws';
import { operations, eventSelections } from './operations';
import type { AuthPayload } from './types';
import { BackendError } from './errors';
export { BackendError } from './errors';
import { LiveAdapter } from './live';
import { defaultBackendMode, endpointFor, type BackendMode } from './config';
type Envelope<T> = {
  data?: T;
  errors?: {
    message: string;
    extensions?: {
      code?: string;
    };
  }[];
};
export const endpoint = endpointFor(defaultBackendMode);
export function extractQrToken(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new BackendError('TOKEN_NOT_FOUND', 'Paste or scan the patient’s current QR URL.');
  if (!trimmed.includes('://')) {
    if (!/^[a-zA-Z0-9._~-]+$/.test(trimmed)) throw new BackendError('TOKEN_NOT_FOUND', 'Enter a QR URL or token.');
    return trimmed;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BackendError('TOKEN_NOT_FOUND', 'Invalid QR URL.');
  }
  const match = url.pathname.match(/^\/scan\/([^/]+)\/?$/);
  if (!['http:', 'https:'].includes(url.protocol) || !match) throw new BackendError('TOKEN_NOT_FOUND', 'This is not a patient scan URL.');
  // Preserve opaque token case. Never navigate to URLs found in QR codes.
  return decodeURIComponent(match[1]);
}
export class SimulationClient {
  auth: AuthPayload | null = null;
  onAuthChange?: (auth: AuthPayload | null) => void;
  private refreshing: Promise<AuthPayload> | null = null;
  private generation = 0;
  private accessExpiresAt = 0;
  mode: BackendMode;
  private live = new LiveAdapter();
  constructor(public url = endpoint, mode: BackendMode = defaultBackendMode) {
    this.mode = mode;
  }
  configure(mode: BackendMode) {
    this.clear();
    this.mode = mode;
    this.url = endpointFor(mode);
  }
  setAuth(auth: AuthPayload) {
    this.auth = auth;
    if (this.mode === 'live') this.live.user = auth.user;
    this.accessExpiresAt = Date.now() + 15 * 60_000;
    this.onAuthChange?.(auth);
  }
  clear() {
    this.generation += 1;
    this.auth = null;
    this.live.reset();
    this.accessExpiresAt = 0;
    this.onAuthChange?.(null);
  }
  private async send<T>(query: string, variables: Record<string, unknown>, accessToken?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? {
            Authorization: `Bearer ${accessToken}`
          } : {})
        },
        body: JSON.stringify({
          query,
          variables
        }),
        cache: 'no-store'
      });
    } catch {
      throw new BackendError('CONNECTION_FAILED', this.mode === 'simulation' ? 'Cannot reach the simulated backend. Start npm run mock:backend and try again.' : 'Cannot reach the live backend. Check the tunnel and refresh before repeating a payment.');
    }
    if (response.status === 401) throw new BackendError('UNAUTHENTICATED', 'Access token expired.');
    let payload: Envelope<T>;
    try {
      payload = await response.json();
    } catch {
      throw new BackendError('BAD_RESPONSE', 'The backend did not return GraphQL JSON.');
    }
    if (payload.errors?.length) {
      const error = payload.errors[0];
      throw new BackendError(error.extensions?.code || 'GRAPHQL_ERROR', error.message);
    }
    if (!response.ok || !payload.data) throw new BackendError('BAD_RESPONSE', 'The backend request failed.');
    return payload.data;
  }
  private async sendAuthenticated<T>(query: string, variables: Record<string, unknown>, authenticated = true): Promise<T> {
    try {
      return await this.send<T>(query, variables, authenticated ? this.auth?.accessToken : undefined);
    } catch (error) {
      if (!authenticated || !(error instanceof BackendError) || error.code !== 'UNAUTHENTICATED' || !this.auth?.refreshToken) throw error;
      await this.refresh();
      // Retry only an explicitly rejected auth request, never a timeout or transport failure.
      return this.send<T>(query, variables, this.auth?.accessToken);
    }
  }
  async request<T>(query: string, variables: Record<string, unknown> = {}, authenticated = true): Promise<T> {
    if (this.mode === 'simulation') return this.sendAuthenticated<T>(query, variables, authenticated);
    // Refresh each rejected HTTP operation independently. Never replay a multi-step
    // clinical action because a later read failed after a successful mutation.
    return (await this.live.request(query, variables, (document, values, auth = authenticated) => this.sendAuthenticated(document, values, auth))) as T;
  }
  refresh(): Promise<AuthPayload> {
    if (this.refreshing) return this.refreshing;
    const refreshToken = this.auth?.refreshToken;
    if (!refreshToken) return Promise.reject(new BackendError('UNAUTHENTICATED', 'Please sign in again.'));
    const generation = this.generation;
    this.refreshing = this.request<{
      refreshToken: AuthPayload;
    }>(operations.refreshToken, {
      refreshToken
    }, false).then(result => {
      if (generation !== this.generation) throw new BackendError('UNAUTHENTICATED', 'The session was signed out.');
      this.setAuth(result.refreshToken);
      return result.refreshToken;
    }).catch(error => {
      if (generation === this.generation) this.clear();
      throw error;
    }).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  subscribe(onEvent: (event: string) => void, onStatus: (status: string) => void) {
    if (this.mode === 'live') {
      onStatus('Live backend · use Refresh');
      return () => {};
    }
    return this.subscribeDocuments(Object.entries(eventSelections).map(([name, selection]) => ({
      name,
      query: `subscription { ${name} { ${selection} } }`,
      variables: {}
    })), onEvent, onStatus);
  }
  watchWorkspace(onUpdate: () => void, onStatus: (status: string) => void) {
    if (this.mode === 'live') {
      onStatus('Live backend · refreshes every 15 seconds');
      return () => {};
    }
    return this.subscribeDocuments([{
      name: 'workspaceChanged',
      query: 'subscription { workspaceChanged }',
      variables: {}
    }], onUpdate, onStatus);
  }
  watchPairing(connectionId: string, onUpdate: () => void, onStatus: (status: string) => void) {
    if (this.mode === 'live') {
      onStatus('Staff pairing is not exposed by the live backend.');
      return () => {};
    }
    return this.subscribeDocuments([{
      name: 'pairingUpdated',
      query: 'subscription PairingUpdated($id: ID!) { pairingUpdated(connectionId: $id) { id status } }',
      variables: {
        id: connectionId
      }
    }], onUpdate, onStatus);
  }
  private subscribeDocuments(documents: {
    name: string;
    query: string;
    variables: Record<string, unknown>;
  }[], onEvent: (event: string) => void, onStatus: (status: string) => void) {
    let expired = false,
      disposed = false;
    const wsUrl = process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || this.url.replace(/^http/, 'ws');
    const client = createClient({
      url: wsUrl,
      lazy: true,
      retryAttempts: 3,
      connectionParams: async () => {
        if (expired || Date.now() >= this.accessExpiresAt) {
          await this.refresh();
          expired = false;
        }
        return {
          authorization: `Bearer ${this.auth?.accessToken || ''}`
        };
      },
      on: {
        connected: () => {
          if (!disposed) onStatus('Live updates connected');
        },
        closed: event => {
          if ((event as CloseEvent).code === 4403) expired = true;
          if (!disposed) onStatus('Live updates reconnecting…');
        }
      }
    });
    const unsubscribe = documents.map(({
      name,
      query,
      variables
    }) => client.subscribe({
      query,
      variables
    }, {
      next: () => {
        if (!disposed) onEvent(name);
      },
      error: () => {
        if (!disposed) onStatus('Live updates unavailable. Use Refresh data.');
      },
      complete: () => {}
    }));
    return () => {
      disposed = true;
      unsubscribe.forEach(fn => fn());
      void client.dispose();
    };
  }
}
export function extractPairingToken(value: string): string {
  const raw = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BackendError('TOKEN_NOT_FOUND', 'Scan a login QR or paste its pairing link.');
  }
  const token = new URLSearchParams(url.hash.slice(1)).get('pair');
  if (!['http:', 'https:'].includes(url.protocol) || !/^\/(simulation|connections|portal)\/?$/.test(url.pathname) || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new BackendError('TOKEN_NOT_FOUND', 'This is not a valid one-time login QR.');
  }
  return token;
}

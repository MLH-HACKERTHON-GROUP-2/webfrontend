export type BackendMode = 'live' | 'simulation';
export const LIVE_ORIGIN = 'https://unstarched-maritally-ike.ngrok-free.dev';
export const defaultBackendMode: BackendMode = process.env.NEXT_PUBLIC_BACKEND_MODE === 'simulation' ? 'simulation' : 'live';
export const simulationEndpoint = process.env.NEXT_PUBLIC_SIMULATION_GRAPHQL_URL || 'http://localhost:4000/graphql';
export const liveEndpoint = '/api/backend/';
export const endpointFor = (mode: BackendMode) => mode === 'simulation' ? simulationEndpoint : liveEndpoint;
export const sessionKeyFor = (mode: BackendMode) => `emerald-auth-v3:${mode}:${endpointFor(mode)}`;
export const pairingKeyFor = (mode: BackendMode) => `emerald-pending-pair:${mode}`;

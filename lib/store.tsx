'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type AppState, type Prescription, type Medicine, type Appointment, type Diagnosis, type Profile } from './data';
import { BackendError, SimulationClient, extractQrToken } from './backend/client';
import { operations } from './backend/operations';
import type { AuthPayload, BackendUser, Role } from './backend/types';
import { defaultBackendMode, sessionKeyFor, type BackendMode } from './backend/config';
export const roleHome = (role: Role) => role === 'PHARMACY' ? '/pharmacy' : role === 'PATIENT' ? '/portal' : role === 'DOCTOR' ? '/dashboard' : '/administration';
export function canVisit(role: Role, path: string) {
  if (role === 'DOCTOR') return ['/dashboard', '/appointments', '/session', '/records', '/profile', '/reports', '/connections'].includes(path);
  if (role === 'PHARMACY') return ['/pharmacy', '/records', '/reports', '/connections'].includes(path);
  if (role === 'PATIENT') return ['/portal', '/records', '/appointments'].includes(path);
  return ['/administration', ...(role === 'HOSPITAL_ADMIN' ? ['/records', '/reports'] : [])].includes(path);
}
const emptyState: AppState = {
  patients: [],
  appointments: [],
  medicines: [],
  prescriptions: [],
  diagnoses: [],
  movements: [],
  notes: [],
  profile: {
    name: '',
    email: '',
    phone: '',
    bio: '',
    specialty: '',
    available: []
  },
  sessions: [],
  payments: []
};
type Store = {
  state: AppState;
  ready: boolean;
  storageError: boolean;
  user: BackendUser | null;
  client: SimulationClient;
  busy: boolean;
  error: string;
  live: string;
  mode: BackendMode;
  setMode: (mode: BackendMode) => void;
  signIn: (identifier: string, otp: string) => Promise<BackendUser>;
  signOut: () => void;
  reload: () => Promise<void>;
  run: (action: () => Promise<void>) => Promise<void>;
  startVisit: (patientId: string, appointmentId?: string) => Promise<void>;
  addAppointment: (item: Omit<Appointment, 'id' | 'status'>) => Promise<boolean>;
  updateAppointment: (id: string, status: Appointment['status']) => Promise<void>;
  addPrescription: (item: Omit<Prescription, 'id' | 'status' | 'date'>) => Promise<void>;
  addDiagnosis: (item: Omit<Diagnosis, 'id' | 'date'>) => Promise<void>;
  addMedicine: (item: Omit<Medicine, 'id'>) => Promise<void>;
  receiveStock: (id: string, quantity: number) => Promise<void>;
  dispense: (id: string) => Promise<void>;
  saveNote: (patientId: string, text: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  saveVitals: (patientId: string, vitals: NonNullable<NonNullable<AppState['sessions']>[number]['vitals']>) => Promise<void>;
  verifyPatient: (value: string) => Promise<string>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({
  children
}: {
  children: ReactNode;
}) {
  const [client] = useState(() => new SimulationClient());
  const [mode, setModeState] = useState<BackendMode>(defaultBackendMode);
  const [state, setState] = useState<AppState>(emptyState);
  const [user, setUser] = useState<BackendUser | null>(null);
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [live, setLive] = useState('Connecting…');
  const generation = useRef(0),
    reads = useRef(0),
    writes = useRef(0),
    mutationLock = useRef(false);
  const persist = useCallback((auth: AuthPayload | null) => {
    try {
      if (auth) sessionStorage.setItem(sessionKeyFor(client.mode), JSON.stringify(auth));else sessionStorage.removeItem(sessionKeyFor(client.mode));
    } catch {
      setStorageError(true);
    }
    setUser(auth?.user || null);
    if (!auth) setState(emptyState);
  }, [client]);
  const reload = useCallback(async () => {
    if (!client.auth) return;
    const identity = generation.current,
      request = ++reads.current;
    const result = await client.request<{
      myWorkspace: AppState;
    }>(operations.workspace);
    if (identity === generation.current && request === reads.current) setState(result.myWorkspace);
  }, [client]);
  useEffect(() => {
    let alive = true;
    client.onAuthChange = persist;
    async function restore() {
      try {
        const current = sessionStorage.getItem('emerald-backend-mode') || defaultBackendMode;
        const linkMode = new URLSearchParams(window.location.hash.slice(1)).get('mode');
        const selected = !sessionStorage.getItem(sessionKeyFor(current === 'simulation' ? 'simulation' : 'live')) && linkMode === 'simulation' ? 'simulation' : current;
        sessionStorage.setItem('emerald-backend-mode', selected);
        const initialMode = selected === 'simulation' || selected === 'live' ? selected : defaultBackendMode;
        client.mode = initialMode;
        client.url = initialMode === 'live' ? '/api/backend/' : process.env.NEXT_PUBLIC_SIMULATION_GRAPHQL_URL || 'http://localhost:4000/graphql';
        setModeState(initialMode);
        const value = sessionStorage.getItem(sessionKeyFor(initialMode));
        if (value) {
          const auth = JSON.parse(value) as AuthPayload;
          if (!auth.accessToken || !auth.refreshToken || !auth.user?.role) throw new Error('Invalid session');
          client.setAuth(auth);
          const result = await client.request<{
            me: BackendUser;
          }>(operations.me);
          if (alive && client.auth) {
            client.setAuth({
              ...client.auth,
              user: result.me
            });
            await reload();
          }
        }
      } catch (e) {
        if (!(e instanceof BackendError) || e.code !== 'CONNECTION_FAILED') client.clear();
        if (alive) setError(e instanceof Error ? e.message : 'Could not restore your session.');
      } finally {
        if (alive) setReady(true);
      }
    }
    void restore();
    return () => {
      alive = false;
      client.onAuthChange = undefined;
      generation.current++;
    };
  }, [client, persist, reload]);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const update = () => {
      void reload().catch(e => {
        if (alive) setError(e.message);
      });
    };
    const stop = client.watchWorkspace(update, status => {
      if (alive) {
        setLive(status);
        if (status === 'Live updates connected') update();
      }
    });
    const visible = () => {
      if (!document.hidden) update();
    };
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 15000);
    return () => {
      alive = false;
      stop();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId, client, reload]);
  useEffect(() => {
    if (!state.accessExpiresAt || user?.role !== 'PHARMACY') return;
    const timer = setTimeout(() => {
      setState(s => ({
        ...s,
        patients: [],
        prescriptions: [],
        diagnoses: [],
        notes: [],
        sessions: []
      }));
      void reload().catch(e => setError(e.message));
    }, Math.max(0, state.accessExpiresAt - Date.now()) + 25);
    return () => clearTimeout(timer);
  }, [state.accessExpiresAt, user?.role, reload]);
  function setMode(next: BackendMode) {
    if (client.auth) throw new Error('Sign out before switching backends.');
    generation.current++;
    reads.current++;
    client.configure(next);
    setModeState(next);
    setState(emptyState);
    setError('');
    try {
      sessionStorage.setItem('emerald-backend-mode', next);
      sessionStorage.removeItem('emerald-pending-pair');
    } catch {
      setStorageError(true);
    }
  }
  async function signIn(identifier: string, otp: string) {
    const result = await client.request<{
      verifyOtp: AuthPayload;
    }>(operations.verifyOtp, {
      input: {
        identifier,
        otp
      }
    }, false);
    generation.current++;
    client.setAuth(result.verifyOtp);
    setError('');
    await reload();
    return result.verifyOtp.user;
  }
  function signOut() {
    generation.current++;
    reads.current++;
    client.clear();
    setError('');
    setState(emptyState);
  }
  async function action(kind: string, input: object) {
    const identity = generation.current,
      write = ++writes.current;
    reads.current++;
    const result = await client.request<{
      workspaceAction: AppState;
    }>(operations.workspaceAction, {
      kind,
      input
    });
    reads.current++;
    if (identity === generation.current && write === writes.current) setState(result.workspaceAction);
    return result.workspaceAction;
  }
  async function run(work: () => Promise<void>) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The action could not be completed.');
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  return <Context.Provider value={{
    state,
    mode,
    setMode,
    ready,
    storageError,
    client,
    user,
    busy,
    error,
    live,
    signIn,
    signOut,
    reload,
    run,
    startVisit: async (patientId, appointmentId) => {
      await action('START_VISIT', {
        patientId,
        appointmentId
      });
    },
    addAppointment: async item => {
      try {
        await action('ADD_APPOINTMENT', item);
        return true;
      } catch (e) {
        if (e instanceof BackendError && e.code === 'APPOINTMENT_CONFLICT') return false;
        throw e;
      }
    },
    updateAppointment: async (id, status) => {
      await action('UPDATE_APPOINTMENT', {
        id,
        status
      });
    },
    addPrescription: async item => {
      await action('ADD_PRESCRIPTION', item);
    },
    addDiagnosis: async item => {
      await action('ADD_DIAGNOSIS', item);
    },
    addMedicine: async item => {
      await action('ADD_MEDICINE', item);
    },
    receiveStock: async (id, quantity) => {
      await action('RECEIVE_STOCK', {
        id,
        quantity
      });
    },
    dispense: async id => {
      await action('DISPENSE', {
        id
      });
    },
    saveNote: async (patientId, text) => {
      await action('SAVE_NOTE', {
        patientId,
        text
      });
    },
    saveProfile: async profile => {
      await action('SAVE_PROFILE', profile);
    },
    saveVitals: async (patientId, vitals) => {
      await action('SAVE_VITALS', {
        patientId,
        vitals
      });
    },
    verifyPatient: async value => {
      const next = await action('VERIFY_PATIENT', {
        token: extractQrToken(value)
      });
      const p = next.patients[0];
      if (!p) throw Error('Patient connection unavailable.');
      return p.id;
    }
  }}>{children}</Context.Provider>;
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw Error('Store missing');
  return store;
}

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { seed, type AppState, type Prescription, type Medicine, type Appointment, type Diagnosis, type Profile, uid, TODAY } from './data';
type Store = {
  state: AppState;
  ready: boolean;
  storageError: boolean;
  addAppointment: (item: Omit<Appointment, 'id' | 'status'>) => boolean;
  updateAppointment: (id: string, status: Appointment['status']) => void;
  addPrescription: (item: Omit<Prescription, 'id' | 'status' | 'date'>) => void;
  addDiagnosis: (item: Omit<Diagnosis, 'id' | 'date'>) => void;
  addMedicine: (item: Omit<Medicine, 'id'>) => void;
  receiveStock: (id: string, quantity: number) => void;
  dispense: (id: string) => void;
  saveNote: (patientId: string, text: string) => void;
  saveProfile: (profile: Profile) => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({
  children
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<AppState>(seed);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      const data = localStorage.getItem('emerald-care-v1');
      if (data) {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed.patients) || !Array.isArray(parsed.medicines) || !Array.isArray(parsed.appointments)) throw Error('Invalid stored data');
        setState({
          ...seed,
          ...parsed
        });
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try {
      localStorage.setItem('emerald-care-v1', JSON.stringify(state));
    } catch {
      setStorageError(true);
    }
  }, [state, ready]);
  function addAppointment(item: Omit<Appointment, 'id' | 'status'>) {
    const minutes = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      return hour * 60 + minute;
    };
    const start = minutes(item.time);
    if (state.appointments.some(a => a.date === item.date && a.status !== 'Cancelled' && Math.abs(minutes(a.time) - start) < 30)) return false;
    setState(s => ({
      ...s,
      appointments: [...s.appointments, {
        ...item,
        id: uid('APT'),
        status: 'Confirmed'
      }]
    }));
    return true;
  }
  function updateAppointment(id: string, status: Appointment['status']) {
    setState(s => ({
      ...s,
      appointments: s.appointments.map(a => a.id === id ? {
        ...a,
        status
      } : a)
    }));
  }
  function addPrescription(item: Omit<Prescription, 'id' | 'status' | 'date'>) {
    setState(s => ({
      ...s,
      prescriptions: [...s.prescriptions, {
        ...item,
        id: uid('RX'),
        status: 'Pending',
        date: TODAY
      }]
    }));
  }
  function addDiagnosis(item: Omit<Diagnosis, 'id' | 'date'>) {
    setState(s => ({
      ...s,
      diagnoses: [...s.diagnoses, {
        ...item,
        id: uid('DX'),
        date: TODAY
      }]
    }));
  }
  function addMedicine(item: Omit<Medicine, 'id'>) {
    const id = uid('MED');
    setState(s => ({
      ...s,
      medicines: [...s.medicines, {
        ...item,
        id
      }],
      movements: [...s.movements, {
        id: uid('MV'),
        medicineId: id,
        quantity: item.stock,
        type: 'Stock received',
        date: TODAY,
        reference: 'New medicine'
      }]
    }));
  }
  function receiveStock(id: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) throw Error('Enter a positive whole quantity.');
    setState(s => ({
      ...s,
      medicines: s.medicines.map(m => m.id === id ? {
        ...m,
        stock: m.stock + quantity
      } : m),
      movements: [...s.movements, {
        id: uid('MV'),
        medicineId: id,
        quantity,
        type: 'Stock received',
        date: TODAY,
        reference: 'Stock replenishment'
      }]
    }));
  }
  function dispense(id: string) {
    const rx = state.prescriptions.find(r => r.id === id);
    if (!rx || rx.status !== 'Pending') throw Error('This prescription has already been served.');
    const med = state.medicines.find(m => m.id === rx.medicineId);
    if (!med || med.stock < rx.quantity) throw Error('Insufficient stock. Receive stock before dispensing.');
    if (med.expiry < TODAY) throw Error('This medicine has expired.');
    setState(s => {
      const current = s.prescriptions.find(r => r.id === id);
      const stock = s.medicines.find(m => m.id === rx.medicineId);
      if (!current || current.status !== 'Pending' || !stock || stock.stock < rx.quantity) return s;
      return {
        ...s,
        prescriptions: s.prescriptions.map(r => r.id === id ? {
          ...r,
          status: 'Dispensed'
        } : r),
        medicines: s.medicines.map(m => m.id === rx.medicineId ? {
          ...m,
          stock: m.stock - rx.quantity
        } : m),
        movements: [...s.movements, {
          id: uid('MV'),
          medicineId: rx.medicineId,
          quantity: rx.quantity,
          type: 'Dispensed',
          date: TODAY,
          reference: id
        }]
      };
    });
  }
  function saveNote(patientId: string, text: string) {
    setState(s => ({
      ...s,
      notes: [...s.notes, {
        id: uid('N'),
        patientId,
        text,
        date: TODAY
      }]
    }));
  }
  function saveProfile(profile: Profile) {
    setState(s => ({
      ...s,
      profile
    }));
  }
  return <Context.Provider value={{
    state,
    ready,
    storageError,
    addAppointment,
    updateAppointment,
    addPrescription,
    addDiagnosis,
    addMedicine,
    receiveStock,
    dispense,
    saveNote,
    saveProfile
  }}>{children}</Context.Provider>;
}
export function useStore() {
  const s = useContext(Context);
  if (!s) throw Error('Store missing');
  return s;
}

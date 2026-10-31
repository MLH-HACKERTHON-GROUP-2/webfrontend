import { operations } from './operations';
import { liveOperations } from './live-operations';
import { BackendError } from './errors';
import type { AppState } from '../data';
import type { AuthPayload, BackendUser, Patient, Pharmacy, Hospital, Session, Item } from './types';
type Variables = Record<string, unknown>;
type Send = (query: string, variables: Variables, authenticated?: boolean) => Promise<Record<string, any>>;
// The raw shapes below are defined by backend/schema.live.graphql.
type Raw = Record<string, any>;
const unsupported = (feature: string): never => {
  throw new BackendError('UNSUPPORTED_FEATURE', `${feature} is not exposed by the live backend. Use Simulation mode to try this feature.`);
};
export function normalizeUser(u: Raw, identifier = ''): BackendUser {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    profileComplete: u.profileComplete,
    identifier: u.email || u.phone || identifier
  };
}
function normalizeSession(s: Raw): Session {
  return {
    ...s,
    patient: {
      ...s.patient,
      user: normalizeUser(s.patient.user)
    },
    doctor: {
      ...s.doctor,
      user: normalizeUser(s.doctor.user)
    },
    vitals: s.vitals ? {
      ...s.vitals,
      heartRate: s.vitals.pulse ?? null,
      weight: s.vitals.weightKg ?? null,
      oxygenSaturation: null
    } : null
  } as Session;
}
function age(dob: string | null) {
  if (!dob) return 0;
  const birth = new Date(dob),
    now = new Date();
  return now.getFullYear() - birth.getFullYear() - (now.getMonth() < birth.getMonth() || now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate() ? 1 : 0);
}
export function normalizePatient(p: Raw): Patient {
  return {
    ...p,
    user: normalizeUser(p.user),
    age: p.dob ? age(p.dob) : null,
    gender: p.sex ?? null,
    bloodGroup: null,
    allergies: p.allergies ?? null,
    sessions: (p.sessions || []).map(normalizeSession)
  } as Patient;
}
function normalizeHospital(h: Raw): Hospital {
  return {
    ...h,
    address: h.address || '',
    doctors: (h.doctors || []).map((d: Raw) => ({
      ...d,
      user: normalizeUser(d.user)
    }))
  } as Hospital;
}
function transactions(wallet: Raw | undefined): NonNullable<AppState['payments']> {
  return (wallet?.transactions || []).map((p: Raw) => ({
    id: p.id,
    kind: p.type === 'MEDICATION' ? 'MEDICINE' : p.type === 'TOPUP' ? 'TOP_UP' : p.type,
    amount: Math.abs(p.amount) * (p.direction === 'DEBIT' ? -1 : 1),
    balance: wallet?.balance || 0,
    occurredAt: p.createdAt
  }));
}
export class LiveAdapter {
  user: BackendUser | null = null;
  private patient: Raw | null = null;
  private pharmacy: Raw | null = null;
  private hospital: Raw | null = null;
  private sessions = new Map<string, Raw>();
  private qrToken = '';
  private scanExpires = 0;
  private pending: Item[] = [];
  private demographicsUnavailable = false;
  reset() {
    this.patient = this.pharmacy = this.hospital = null;
    this.user = null;
    this.sessions.clear();
    this.qrToken = '';
    this.pending = [];
    this.scanExpires = 0;
  }
  private remember(s: Raw) {
    this.sessions.set(s.id, s);
    if (!this.patient || this.patient.id === s.patient.id) this.patient = {
      ...s.patient,
      sessions: [...this.sessions.values()].filter(item => item.patient.id === s.patient.id)
    };
  }
  private async scan(token: string, send: Send) {
    let candidate: Raw | null = null,
      pending: Item[] = [],
      unavailable = false;
    if (this.user?.role === 'DOCTOR') candidate = (await send(liveOperations.lookup, {
      token
    })).patientByQrToken;else if (this.user?.role === 'PHARMACY') {
      pending = (await send(liveOperations.pending, {
        qrToken: token
      })).pendingPrescriptionItems;
      try {
        candidate = (await send(liveOperations.lookup, {
          token
        })).patientByQrToken;
      } catch (e) {
        if (!(e instanceof BackendError) || e.code !== 'FORBIDDEN') throw e;
        unavailable = true;
      }
    } else unsupported('Patient scanning for this role');
    // Commit a successful scan together. Never carry another patient's history
    // or prescription items into a newly scanned pharmacy view.
    this.sessions.clear();
    this.patient = candidate;
    this.pending = pending;
    this.demographicsUnavailable = unavailable;
    this.qrToken = token;
    this.scanExpires = Date.now() + 120000;
    for (const s of candidate?.sessions || []) this.sessions.set(s.id, s);
  }
  private snapshot(): AppState {
    const u = this.user!;
    const visibleSessions = [...this.sessions.values()];
    const people = new Map<string, Raw>();
    if (this.patient) people.set(this.patient.id, this.patient);
    if (u.role === 'DOCTOR') for (const s of visibleSessions) people.set(s.patient.id, {
      ...people.get(s.patient.id),
      ...s.patient
    });
    if (u.role === 'PHARMACY' && this.qrToken && !this.patient) people.set('verified-scan', {
      id: 'verified-scan',
      publicId: 'verified-scan',
      user: {
        name: 'Patient with verified QR',
        email: '',
        id: 'verified-scan'
      },
      sessions: []
    });
    const prices: Raw[] = this.pharmacy?.drugPrices || [];
    const medicines = new Map<string, AppState['medicines'][number]>();
    const med = (name: string) => {
      const key = `live:${name}`;
      if (!medicines.has(key)) medicines.set(key, {
        id: key,
        name,
        generic: '',
        category: 'Live price list',
        strength: '',
        stock: 0,
        threshold: -1,
        price: prices.find(p => p.drugName.toLowerCase() === name.toLowerCase())?.price ?? 0,
        expiry: ''
      });
      return key;
    };
    for (const p of prices) med(p.drugName);
    const prescriptions: AppState['prescriptions'] = [],
      diagnoses: AppState['diagnoses'] = [],
      notes: AppState['notes'] = [];
    for (const s of visibleSessions) {
      if (s.diagnosis) diagnoses.push({
        id: s.diagnosis.id || `DX-${s.id}`,
        patientId: s.patient.publicId,
        name: s.diagnosis.code || 'Clinical assessment',
        code: s.diagnosis.code || '',
        notes: s.diagnosis.notes,
        date: s.startedAt.slice(0, 10)
      });
      if (s.vitals?.notes) notes.push({
        id: `N-${s.id}`,
        patientId: s.patient.publicId,
        text: s.vitals.notes,
        date: s.startedAt.slice(0, 10)
      });
      for (const item of s.prescription?.items || []) prescriptions.push({
        id: item.id,
        patientId: s.patient.publicId,
        medicineId: med(item.drugName),
        quantity: item.quantity,
        dosage: item.dosage,
        duration: 'As prescribed',
        instructions: item.instructions || '',
        status: item.status === 'DISPENSED' ? 'Dispensed' : 'Pending',
        date: s.startedAt.slice(0, 10),
        finalized: s.status === 'FINALIZED',
        sessionId: s.id
      });
    }
    if (u.role === 'PHARMACY') for (const i of this.pending) if (!prescriptions.some(r => r.id === i.id)) prescriptions.push({
      id: i.id,
      patientId: this.patient?.publicId || 'verified-scan',
      medicineId: med(i.drugName),
      quantity: i.quantity,
      dosage: i.dosage,
      duration: 'As prescribed',
      instructions: (i as Raw).instructions || '',
      status: i.status === 'DISPENSED' ? 'Dispensed' : 'Pending',
      date: i.dispensedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      finalized: true
    });
    const wallet = u.role === 'PATIENT' ? this.patient?.wallet : u.role === 'PHARMACY' ? this.pharmacy?.wallet : this.hospital?.wallet;
    return {
      patients: [...people.values()].map(p => ({
        id: p.publicId,
        name: p.user.name,
        age: p.dob ? age(p.dob) : 0,
        gender: p.sex || 'Not supplied',
        blood: 'Not supplied',
        phone: p.user.phone || '',
        email: p.user.email || '',
        case: 'Clinical assessment',
        allergies: p.allergies || 'Not supplied',
        color: 'mint'
      })),
      appointments: [],
      medicines: [...medicines.values()],
      prescriptions,
      diagnoses,
      notes,
      movements: [],
      profile: {
        name: u.name,
        email: u.identifier,
        phone: '',
        specialty: u.role === 'DOCTOR' ? 'Doctor' : u.role === 'PHARMACY' ? 'Pharmacist' : 'Care team',
        bio: '',
        available: []
      },
      sessions: visibleSessions.map(s => ({
        id: s.id,
        startedAt: s.startedAt,
        patientId: s.patient.publicId,
        doctorId: s.doctor.user.id,
        status: s.status,
        appointmentId: null,
        vitals: s.vitals ? {
          bloodPressure: s.vitals.bloodPressure,
          heartRate: s.vitals.pulse,
          weight: s.vitals.weightKg,
          temperature: s.vitals.temperature
        } : null
      })),
      wallet: wallet?.balance || 0,
      payments: transactions(wallet),
      hospitalName: this.hospital?.name || this.pharmacy?.name || visibleSessions[0]?.hospital?.name || 'Emerald Care',
      accessExpiresAt: u.role === 'PHARMACY' && this.qrToken ? this.scanExpires : null,
      liveNotice: this.demographicsUnavailable ? 'The live API allows prescription lookup but does not permit this account to read patient demographics.' : undefined
    };
  }
  private async load(send: Send) {
    if (!this.user) throw new BackendError('UNAUTHENTICATED', 'Sign in first.');
    if (this.user.role === 'PATIENT') {
      this.patient = (await send(liveOperations.patient, {})).myPatientProfile;
      this.sessions.clear();
      for (const s of this.patient?.sessions || []) this.sessions.set(s.id, s);
    } else if (this.user.role === 'DOCTOR') {
      const s = (await send(liveOperations.active, {})).myActiveSession;
      if (s) this.remember(s);
      for (const cached of this.sessions.values()) if (cached.status === 'ACTIVE' && cached.id !== s?.id) this.remember((await send(liveOperations.session, {
        id: cached.id
      })).session);
    } else if (this.user.role === 'PHARMACY') {
      this.pharmacy = (await send(liveOperations.pharmacy, {})).myPharmacy;
      if (this.qrToken && Date.now() < this.scanExpires) {
        try {
          this.pending = (await send(liveOperations.pending, {
            qrToken: this.qrToken
          })).pendingPrescriptionItems;
        } catch (e) {
          if (!(e instanceof BackendError) || !['TOKEN_EXPIRED', 'TOKEN_NOT_FOUND', 'FORBIDDEN'].includes(e.code)) throw e;
          this.qrToken = '';
        }
      } else this.qrToken = '';
      if (!this.qrToken) {
        this.patient = null;
        this.pending = [];
        this.sessions.clear();
      }
    } else if (this.user.role === 'HOSPITAL_ADMIN') this.hospital = (await send(liveOperations.hospital, {})).myHospital;
    return this.snapshot();
  }
  private async action(kind: string, input: Raw, send: Send) {
    if (kind === 'VERIFY_PATIENT') {
      await this.scan(input.token, send);
      return this.load(send);
    }
    if (kind === 'START_VISIT') {
      if (!this.patient || this.patient.publicId !== input.patientId || !this.qrToken) throw new BackendError('TOKEN_NOT_FOUND', 'Scan the patient’s current QR before starting a live visit.');
      this.remember((await send(liveOperations.start, {
        qrToken: this.qrToken
      })).startSession);
    } else if (kind === 'DISPENSE') await send(liveOperations.dispense, {
      itemId: input.id
    });else {
      const s = [...this.sessions.values()].find(s => s.patient.publicId === input.patientId && s.status === 'ACTIVE' && s.doctor.user.id === this.user?.id);
      if (!['ADD_DIAGNOSIS', 'ADD_PRESCRIPTION', 'SAVE_VITALS', 'SAVE_NOTE'].includes(kind)) unsupported(({
        ADD_APPOINTMENT: 'Appointment booking',
        UPDATE_APPOINTMENT: 'Appointment changes',
        ADD_MEDICINE: 'Inventory creation',
        RECEIVE_STOCK: 'Stock receipts',
        SAVE_PROFILE: 'Doctor profile editing'
      } as Record<string, string>)[kind] || kind);
      if (!s) throw new BackendError('SESSION_NOT_ACTIVE', 'Start this patient’s live visit before saving clinical information.');
      if (kind === 'ADD_DIAGNOSIS') await send(liveOperations.diagnosis, {
        input: {
          sessionId: s.id,
          code: input.code || null,
          notes: `${input.name}: ${input.notes}`
        }
      });
      if (kind === 'SAVE_NOTE') await send(liveOperations.vitals, {
        input: {
          sessionId: s.id,
          notes: [s.vitals?.notes, input.text].filter(Boolean).join('\n\n')
        }
      });
      if (kind === 'SAVE_VITALS') {
        const v = input.vitals;
        if (v.oxygenSaturation != null) unsupported('Oxygen saturation recording');
        await send(liveOperations.vitals, {
          input: {
            sessionId: s.id,
            bloodPressure: v.bloodPressure,
            pulse: v.heartRate,
            weightKg: v.weight,
            temperature: v.temperature
          }
        });
      }
      if (kind === 'ADD_PRESCRIPTION') {
        const drugName = String(input.medicineId).startsWith('live:') ? String(input.medicineId).slice(5) : '';
        if (!drugName.trim()) throw new BackendError('BAD_USER_INPUT', 'Enter the medicine name.');
        const items = (s.prescription?.items || []).map((i: Raw) => ({
          drugName: i.drugName,
          dosage: i.dosage,
          quantity: i.quantity,
          instructions: i.instructions
        }));
        items.push({
          drugName,
          dosage: input.dosage,
          quantity: input.quantity,
          instructions: [input.duration, input.instructions].filter(Boolean).join('\n')
        });
        await send(liveOperations.prescription, {
          input: {
            sessionId: s.id,
            items
          }
        });
      }
      this.remember((await send(liveOperations.session, {
        id: s.id
      })).session);
    }
    return this.load(send);
  }
  async request(query: string, variables: Variables, send: Send): Promise<unknown> {
    const key = Object.entries(operations).find(([, value]) => value === query)?.[0] || '';
    if (key === 'workspace') return {
      myWorkspace: await this.load(send)
    };
    if (key === 'workspaceAction') return {
      workspaceAction: await this.action(String(variables.kind), variables.input as Raw, send)
    };
    if (!key || !(key in liveOperations)) unsupported('This operation');
    const mapped = liveOperations[key as keyof typeof liveOperations];
    let vars = variables;
    if (key === 'profile') {
      const input = variables.input as Raw;
      vars = {
        input: {
          name: input.name,
          allergies: input.allergies || null,
          sex: input.sex || input.gender || null,
          ...(input.dob ? {
            dob: new Date(input.dob + 'T00:00:00.000Z').toISOString()
          } : {})
        }
      };
    }
    const result = await send(mapped, vars, !['requestOtp', 'verifyOtp', 'refreshToken'].includes(key));
    if (key === 'me') {
      this.user = normalizeUser(result.me, this.user?.identifier);
      return {
        me: this.user
      };
    }
    if (key === 'verifyOtp' || key === 'refreshToken') {
      const payload = result[key] as AuthPayload;
      this.user = normalizeUser(payload.user, String((variables.input as Raw)?.identifier || this.user?.identifier || ''));
      return {
        [key]: {
          ...payload,
          user: this.user
        }
      };
    }
    if (key === 'patient') return {
      myPatientProfile: normalizePatient(result.myPatientProfile)
    };
    if (key === 'profile') {
      this.patient = result.completePatientProfile;
      this.user = normalizeUser(this.patient!.user, this.user?.identifier);
      return {
        completePatientProfile: this.user
      };
    }
    if (key === 'hospital') return {
      myHospital: normalizeHospital(result.myHospital),
      hospitalSessions: []
    };
    if (key === 'system') return {
      allHospitals: result.allHospitals.map(normalizeHospital),
      allPharmacies: result.allPharmacies.map((p: Raw) => ({
        ...p,
        address: p.address || ''
      }))
    };
    if (key === 'finalize') {
      this.remember(result.finalizeSession);
      return {
        finalizeSession: normalizeSession(result.finalizeSession)
      };
    }
    if (key === 'pharmacy') return {
      myPharmacy: {
        ...result.myPharmacy,
        address: result.myPharmacy.address || ''
      } as Pharmacy
    };
    return result;
  }
}

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildSchema, GraphQLError } from 'graphql';
import { createPairingService } from './pairing.mjs';
import { createWorkspaceService } from './workspace.mjs';
export const schema = buildSchema(readFileSync(new URL('./schema.provisional.graphql', import.meta.url), 'utf8'));
export function createSimulation({
  now = Date.now,
  accessTtl = 15 * 60_000,
  refreshTtl = 7 * 86400_000,
  qrTtl = 120_000,
  seedWorkspace = false,
  scanOrigin = 'http://localhost:3000'
} = {}) {
  const users = [],
    patients = [],
    doctors = [],
    hospitals = [],
    pharmacies = [],
    sessions = [],
    payments = [];
  const accessTokens = new Map(),
    refreshTokens = new Map(),
    qrTokens = new Map(),
    listeners = new Map();
  const fail = (code, message) => {
    throw new GraphQLError(message, {
      extensions: {
        code
      }
    });
  };
  const iso = () => new Date(now()).toISOString();
  const normalize = value => value.trim().toLowerCase();
  const money = value => Math.round(value * 100) / 100;
  const positive = (value, label) => {
    if (!Number.isFinite(value) || value <= 0) fail('BAD_USER_INPUT', `${label} must be positive.`);
  };
  function user(name, identifier, role, profileComplete = true) {
    if (users.some(u => normalize(u.identifier) === normalize(identifier))) fail('BAD_USER_INPUT', 'Identifier is already registered.');
    const u = {
      id: randomUUID(),
      name,
      identifier: normalize(identifier),
      role,
      profileComplete
    };
    users.push(u);
    return u;
  }
  const hospitalAdmin = user('Alex Morgan', 'hospital@emerald.care', 'HOSPITAL_ADMIN');
  const hospital = {
    id: 'H-1001',
    adminId: hospitalAdmin.id,
    name: 'Emerald Medical Centre',
    address: 'Johannesburg',
    consultationFee: 150,
    wallet: {
      balance: 0
    }
  };
  hospitals.push(hospital);
  const doctorUser = user('Dr. Sarah Mitchell', 'doctor@emerald.care', 'DOCTOR');
  const doctor = {
    id: 'D-1001',
    user: doctorUser,
    hospitalId: hospital.id
  };
  doctors.push(doctor);
  const pharmacyUser = user('Taylor Jacobs', 'pharmacy@emerald.care', 'PHARMACY');
  pharmacies.push({
    id: 'PH-1001',
    userId: pharmacyUser.id,
    name: 'Emerald Pharmacy',
    address: 'Johannesburg',
    wallet: {
      balance: 0
    },
    drugPrices: [{
      drugName: 'Amlodipine',
      price: 2.5
    }, {
      drugName: 'Metformin',
      price: 1.2
    }]
  });
  user('System Administrator', 'system@emerald.care', 'SYSTEM_ADMIN');
  for (const [index, name, identifier, complete, balance] of [[1, 'Olivia Rhye', 'patient@emerald.care', true, 1000], [2, 'New Patient', 'new.patient@emerald.care', false, 0], [3, 'Avery Patel', 'avery.patient@emerald.care', true, 1000]]) {
    patients.push({
      id: `P-${index}`,
      publicId: index === 2 ? 'PT-1099' : index === 3 ? 'PT-1009' : 'PT-1001',
      user: user(name, identifier, 'PATIENT', complete),
      age: complete ? 32 : null,
      gender: complete ? 'Female' : null,
      bloodGroup: complete ? 'O+' : null,
      allergies: complete ? 'Penicillin' : null,
      wallet: {
        balance
      }
    });
  }
  const patientOf = userId => patients.find(p => p.user.id === userId);
  const doctorOf = userId => doctors.find(d => d.user.id === userId);
  const pharmacyOf = userId => pharmacies.find(p => p.userId === userId);
  const hospitalOf = userId => hospitals.find(h => h.adminId === userId);
  function requireRole(context, ...roles) {
    const entry = accessTokens.get(context?.accessToken);
    if (!entry || entry.expires <= now()) fail('UNAUTHENTICATED', 'Your session has expired. Sign in again.');
    if (!roles.includes(entry.user.role)) fail('FORBIDDEN', 'This action is not available for your role.');
    return entry.user;
  }
  function payload(u, refreshToken) {
    const accessToken = randomUUID();
    accessTokens.set(accessToken, {
      user: u,
      expires: now() + accessTtl
    });
    if (!refreshToken) {
      refreshToken = randomUUID();
      refreshTokens.set(refreshToken, {
        user: u,
        expires: now() + refreshTtl
      });
    }
    return {
      accessToken,
      refreshToken,
      user: u
    };
  }
  function patientByToken(token) {
    const entry = qrTokens.get(token);
    if (!entry) fail('TOKEN_NOT_FOUND', 'QR code is invalid or was replaced. Ask the patient to refresh it.');
    if (entry.expires <= now()) fail('TOKEN_EXPIRED', 'QR code expired. Ask the patient to refresh it and rescan.');
    return entry.patient;
  }
  function activeSession(id, context) {
    const u = requireRole(context, 'DOCTOR');
    const s = sessions.find(s => s.id === id);
    if (!s) fail('NOT_FOUND', 'Session not found.');
    if (s.doctor.user.id !== u.id) fail('FORBIDDEN', 'This session belongs to another doctor.');
    if (s.status !== 'ACTIVE') fail('SESSION_NOT_ACTIVE', 'This session is finalized and cannot be edited.');
    return s;
  }
  function publish(name, patient, data, hospitalId) {
    for (const callback of listeners.get(name) || []) callback({
      patientId: patient.id,
      hospitalId,
      data
    });
  }
  function payment(patient, kind, amount, providerId) {
    const event = {
      id: randomUUID(),
      kind,
      amount,
      balance: patient.wallet.balance,
      occurredAt: iso()
    };
    payments.push({
      patientId: patient.id,
      providerId,
      ...event
    });
    publish('myPaymentEvents', patient, event);
    pairing.notifyPatient(patient.id);
  }
  function stream(name, context) {
    const u = requireRole(context, 'PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN', 'PHARMACY', 'SYSTEM_ADMIN');
    if (name === 'myPaymentEvents' && u.role !== 'PATIENT') fail('FORBIDDEN', 'Patient payment subscription only.');
    const queue = [];
    let resolve;
    let closed = false;
    const allowed = event => u.role === 'PATIENT' ? event.patientId === patientOf(u.id)?.id : u.role === 'DOCTOR' ? event.hospitalId === doctorOf(u.id)?.hospitalId : u.role === 'HOSPITAL_ADMIN' ? event.hospitalId === hospitalOf(u.id)?.id : false;
    const handler = event => {
      if (closed || !allowed(event)) return;
      if (resolve) {
        const done = resolve;
        resolve = undefined;
        done({
          value: {
            [name]: event.data
          },
          done: false
        });
      } else queue.push({
        [name]: event.data
      });
    };
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(handler);
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (closed) return Promise.resolve({
          done: true
        });
        if (queue.length) return Promise.resolve({
          value: queue.shift(),
          done: false
        });
        return new Promise(r => {
          resolve = r;
        });
      },
      return() {
        closed = true;
        listeners.get(name).delete(handler);
        resolve?.({
          done: true
        });
        return Promise.resolve({
          done: true
        });
      }
    };
  }
  function startForPatient(p, context) {
    const u = requireRole(context, 'DOCTOR');
    if (sessions.some(s => s.patient.id === p.id && s.status === 'ACTIVE')) fail('SESSION_ALREADY_ACTIVE', 'This patient already has an active session.');
    const s = {
      id: randomUUID(),
      status: 'ACTIVE',
      startedAt: iso(),
      finalizedAt: null,
      patient: p,
      doctor: doctorOf(u.id),
      vitals: null,
      diagnosis: null,
      prescription: null
    };
    sessions.push(s);
    publish('sessionStarted', p, s, s.doctor.hospitalId);
    pairing.notifyPatient(p.id);
    return s;
  }
  const pendingItems = p => sessions.filter(s => s.patient.id === p.id && s.status === 'FINALIZED').flatMap(s => s.prescription?.items.filter(i => i.status === 'PENDING') ?? []);
  const pairing = createPairingService({
    now,
    requireRole,
    patientOf,
    pendingItems,
    fail,
    scanOrigin,
    qrTtl,
    paymentRecords: (patient, providerId) => payments.filter(p => p.patientId === patient.id && p.providerId === providerId),
    startSession: (p, c) => root._startWorkspaceSession(p, c),
    dispense: (itemId, context) => root.dispensePrescriptionItem({
      itemId
    }, context)
  });
  const root = {
    me: (_, c) => requireRole(c, 'PATIENT', 'HOSPITAL_ADMIN', 'DOCTOR', 'PHARMACY', 'SYSTEM_ADMIN'),
    requestOtp: ({
      input
    }) => {
      if (!input.identifier.trim()) fail('BAD_USER_INPUT', 'Enter your identifier.');
      return true;
    },
    verifyOtp: ({
      input
    }) => {
      if (input.otp !== '000000') fail('BAD_USER_INPUT', 'The simulation code is 000000.');
      const u = users.find(u => u.identifier === normalize(input.identifier));
      if (!u) fail('NOT_FOUND', 'No simulated account found. Choose one of the provided accounts.');
      return payload(u);
    },
    refreshToken: ({
      refreshToken
    }) => {
      const t = refreshTokens.get(refreshToken);
      if (!t || t.expires <= now()) fail('UNAUTHENTICATED', 'Refresh token expired. Sign in again.');
      return payload(t.user, refreshToken);
    },
    myPatientProfile: (_, c) => patientOf(requireRole(c, 'PATIENT').id),
    completePatientProfile: ({
      input
    }, c) => {
      const u = requireRole(c, 'PATIENT');
      if (!input.name.trim() || input.age < 0 || input.age > 130) fail('BAD_USER_INPUT', 'Enter a valid name and age.');
      const p = patientOf(u.id);
      u.name = input.name.trim();
      u.profileComplete = true;
      Object.assign(p, {
        age: input.age,
        gender: input.gender,
        bloodGroup: input.bloodGroup ?? null,
        allergies: input.allergies ?? null
      });
      return u;
    },
    generateQrToken: (_, c) => {
      const u = requireRole(c, 'PATIENT');
      if (!u.profileComplete) fail('FORBIDDEN', 'Complete your profile first.');
      const p = patientOf(u.id);
      for (const [key, value] of qrTokens) if (value.patient.id === p.id) qrTokens.delete(key);
      const token = randomUUID();
      const expires = now() + qrTtl;
      qrTokens.set(token, {
        patient: p,
        expires
      });
      return {
        token,
        qrCodeUrl: `${scanOrigin}/scan/${token}`,
        expiresAt: new Date(expires).toISOString()
      };
    },
    patientByQrToken: ({
      token
    }, c) => {
      requireRole(c, 'DOCTOR');
      return patientByToken(token);
    },
    startSession: ({
      qrToken
    }, c) => {
      requireRole(c, 'DOCTOR');
      return startForPatient(patientByToken(qrToken), c);
    },
    recordVitals: ({
      sessionId,
      input
    }, c) => {
      const s = activeSession(sessionId, c);
      for (const value of Object.values(input)) if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) fail('BAD_USER_INPUT', 'Vitals cannot be negative.');
      s.vitals = {
        ...input
      };
      pairing.notifyPatient(s.patient.id);
      return s;
    },
    recordDiagnosis: ({
      sessionId,
      input
    }, c) => {
      const s = activeSession(sessionId, c);
      if (!input.notes.trim()) fail('BAD_USER_INPUT', 'Enter your assessment.');
      s.diagnosis = {
        notes: input.notes.trim()
      };
      pairing.notifyPatient(s.patient.id);
      return s;
    },
    createPrescription: ({
      sessionId,
      input
    }, c) => {
      const s = activeSession(sessionId, c);
      if (!input.items.length || input.items.some(i => !i.drugName.trim() || !i.dosage.trim() || !Number.isInteger(i.quantity) || i.quantity <= 0)) fail('BAD_USER_INPUT', 'Each item needs a medicine, dosage and positive whole quantity.');
      s.prescription = {
        items: input.items.map(i => ({
          id: randomUUID(),
          drugName: i.drugName.trim(),
          dosage: i.dosage.trim(),
          quantity: i.quantity,
          status: 'PENDING',
          dispensedAt: null
        }))
      };
      pairing.notifyPatient(s.patient.id);
      return s;
    },
    finalizeSession: ({
      sessionId
    }, c) => {
      const s = activeSession(sessionId, c);
      const h = hospitals.find(h => h.id === s.doctor.hospitalId);
      if (s.patient.wallet.balance < h.consultationFee) fail('INSUFFICIENT_FUNDS', 'Ask the patient to top up before completing the consultation.');
      s.patient.wallet.balance = money(s.patient.wallet.balance - h.consultationFee);
      h.wallet.balance = money(h.wallet.balance + h.consultationFee);
      s.status = 'FINALIZED';
      s.finalizedAt = iso();
      payment(s.patient, 'CONSULTATION', -h.consultationFee, s.doctor.user.id);
      publish('sessionFinalized', s.patient, s, h.id);
      if (s.prescription?.items.length) publish('prescriptionReady', s.patient, s, h.id);
      return s;
    },
    topUpWallet: ({
      amount
    }, c) => {
      const p = patientOf(requireRole(c, 'PATIENT').id);
      positive(amount, 'Amount');
      p.wallet.balance = money(p.wallet.balance + amount);
      payment(p, 'TOP_UP', amount);
      return p.wallet;
    },
    myDoctor: (_, c) => doctorOf(requireRole(c, 'DOCTOR').id),
    myHospital: (_, c) => hospitalOf(requireRole(c, 'HOSPITAL_ADMIN').id),
    hospitalSessions: ({
      status
    }, c) => {
      const h = hospitalOf(requireRole(c, 'HOSPITAL_ADMIN').id);
      return sessions.filter(s => s.doctor.hospitalId === h.id && (!status || s.status === status));
    },
    myPharmacy: (_, c) => pharmacyOf(requireRole(c, 'PHARMACY').id),
    pendingPrescriptionItems: ({
      qrToken
    }, c) => {
      requireRole(c, 'PHARMACY');
      const p = patientByToken(qrToken);
      return sessions.filter(s => s.patient.id === p.id && s.status === 'FINALIZED').flatMap(s => s.prescription?.items.filter(i => i.status === 'PENDING') ?? []);
    },
    setPharmacyDrugPrice: ({
      input
    }, c) => {
      const p = pharmacyOf(requireRole(c, 'PHARMACY').id);
      if (!input.drugName.trim() || !Number.isFinite(input.price) || input.price < 0) fail('BAD_USER_INPUT', 'Enter a valid medicine and price.');
      const entry = p.drugPrices.find(i => normalize(i.drugName) === normalize(input.drugName));
      if (entry) entry.price = money(input.price);else p.drugPrices.push({
        drugName: input.drugName.trim(),
        price: money(input.price)
      });
      return entry || p.drugPrices.at(-1);
    },
    dispensePrescriptionItem: ({
      itemId
    }, c) => {
      const p = pharmacyOf(requireRole(c, 'PHARMACY').id);
      const s = sessions.find(s => s.prescription?.items.some(i => i.id === itemId));
      if (!s) fail('NOT_FOUND', 'Prescription item not found.');
      if (s.status !== 'FINALIZED') fail('SESSION_NOT_ACTIVE', 'Only finalized prescriptions can be dispensed.');
      const item = s.prescription.items.find(i => i.id === itemId);
      if (item.status === 'DISPENSED') fail('ALREADY_DISPENSED', 'This item has already been served. Refresh the pending list.');
      const price = p.drugPrices.find(i => normalize(i.drugName) === normalize(item.drugName));
      if (!price) fail('PRICE_NOT_SET', 'Set a price for this medicine before dispensing.');
      const total = money(price.price * item.quantity);
      if (s.patient.wallet.balance < total) fail('INSUFFICIENT_FUNDS', 'Ask the patient to top up before dispensing.');
      s.patient.wallet.balance = money(s.patient.wallet.balance - total);
      p.wallet.balance = money(p.wallet.balance + total);
      item.status = 'DISPENSED';
      item.dispensedAt = iso();
      payment(s.patient, 'MEDICINE', -total, p.userId);
      publish('prescriptionDispensed', s.patient, item, s.doctor.hospitalId);
      return item;
    },
    onboardDoctor: ({
      input
    }, c) => {
      const h = hospitalOf(requireRole(c, 'HOSPITAL_ADMIN').id);
      const d = {
        id: randomUUID(),
        user: user(input.name, input.identifier, 'DOCTOR'),
        hospitalId: h.id
      };
      doctors.push(d);
      return d;
    },
    onboardHospital: ({
      input
    }, c) => {
      requireRole(c, 'SYSTEM_ADMIN');
      positive(input.consultationFee, 'Consultation fee');
      const u = user(input.adminName, input.adminIdentifier, 'HOSPITAL_ADMIN');
      const h = {
        id: randomUUID(),
        adminId: u.id,
        name: input.name,
        address: input.address,
        consultationFee: money(input.consultationFee),
        wallet: {
          balance: 0
        }
      };
      hospitals.push(h);
      return h;
    },
    onboardPharmacy: ({
      input
    }, c) => {
      requireRole(c, 'SYSTEM_ADMIN');
      const u = user(input.userName, input.userIdentifier, 'PHARMACY');
      const p = {
        id: randomUUID(),
        userId: u.id,
        name: input.name,
        address: input.address,
        wallet: {
          balance: 0
        },
        drugPrices: []
      };
      pharmacies.push(p);
      return p;
    },
    allHospitals: (_, c) => {
      requireRole(c, 'SYSTEM_ADMIN');
      return hospitals;
    },
    allPharmacies: (_, c) => {
      requireRole(c, 'SYSTEM_ADMIN');
      return pharmacies;
    }
  };
  Object.assign(root, pairing.root);
  root._startWorkspaceSession = startForPatient;
  const workspace = createWorkspaceService({ now, enabled: seedWorkspace, users, patients, doctors, hospitals, pharmacies, sessions, payments, user, requireRole, fail, root, pairing, patientByToken });
  Object.assign(root, workspace.root);
  // Provisional read relations, calculated from the shared server state.
  for (const p of patients) p.sessions = () => sessions.filter(s => s.patient.id === p.id);
  for (const d of doctors) d.sessions = () => sessions.filter(s => s.doctor.id === d.id);
  for (const h of hospitals) h.doctors = () => doctors.filter(d => d.hospitalId === h.id);
  // Newly onboarded objects need the same lazy relations.
  const fieldResolver = (source, args, context, info) => {
    if (info.parentType.name === 'Patient' && info.fieldName === 'sessions') return sessions.filter(s => s.patient.id === source.id);
    if (info.parentType.name === 'Doctor' && info.fieldName === 'sessions') {
      const u = requireRole(context, 'DOCTOR', 'PATIENT', 'PHARMACY', 'HOSPITAL_ADMIN');
      return sessions.filter(s => s.doctor.id === source.id && (u.role === 'DOCTOR' ? s.doctor.user.id === u.id : u.role === 'PATIENT' ? s.patient.user.id === u.id : u.role === 'PHARMACY' ? pairing.canReadPatient(u.id, s.patient.id) : s.doctor.hospitalId === hospitalOf(u.id)?.id));
    }
    if (info.parentType.name === 'Hospital' && info.fieldName === 'doctors') return doctors.filter(d => d.hospitalId === source.id);
    const field = source?.[info.fieldName];
    return typeof field === 'function' ? field.call(source, args, context, info) : field;
  };
  for (const name of ['sessionStarted', 'sessionFinalized', 'prescriptionReady', 'prescriptionDispensed', 'myPaymentEvents']) root[name] = (_, c) => stream(name, c);
  return {
    root,
    fieldResolver,
    requireRole
  };
}

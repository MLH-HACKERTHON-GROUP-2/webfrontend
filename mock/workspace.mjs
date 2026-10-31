import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// The normal app and the GraphQL clinical operations share these same entities.
// This is a provisional local API extension, not a replacement backend contract.
const fixture = JSON.parse(readFileSync(new URL('./workspace.seed.json', import.meta.url), 'utf8'));
export function createWorkspaceService({
  now,
  enabled,
  patients,
  doctors,
  hospitals,
  pharmacies,
  sessions,
  payments,
  user,
  requireRole,
  fail,
  root,
  pairing,
  patientByToken
}) {
  const firstDoctor = doctors[0],
    firstPharmacy = pharmacies[0];
  const appointments = enabled ? structuredClone(fixture.appointments).map(a => ({
    ...a,
    doctorId: firstDoctor.user.id
  })) : [];
  const inventories = new Map(),
    movements = new Map(),
    profiles = new Map(),
    scans = new Map();
  const listeners = new Set();
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const allRoles = ['DOCTOR', 'PHARMACY', 'PATIENT', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN'];
  const text = (value, label, max = 5000) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) fail('BAD_USER_INPUT', `Enter a valid ${label}.`);
    return value.trim();
  };
  const integer = (value, label, min = 1) => {
    if (!Number.isSafeInteger(value) || value < min || value > 1_000_000) fail('BAD_USER_INPUT', `Enter a valid whole ${label}.`);
    return value;
  };
  const date = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('BAD_USER_INPUT', 'Enter a valid date.');
    return value;
  };
  const inventory = u => {
    if (!inventories.has(u.id)) inventories.set(u.id, []);
    return inventories.get(u.id);
  };
  const catalogue = () => [...new Map([...fixture.medicines, ...[...inventories.values()].flat()].map(m => [m.id, m])).values()];
  if (enabled) {
    inventories.set(firstPharmacy.userId, structuredClone(fixture.medicines));
    firstPharmacy.drugPrices = fixture.medicines.map(m => ({
      drugName: m.name,
      price: m.price
    }));
    movements.set(firstPharmacy.userId, structuredClone(fixture.movements));
    // The complete UI fixture is provisioned once on the server, never per browser.
    for (const p of fixture.patients) {
      let found = patients.find(item => item.publicId === p.id);
      if (!found) {
        found = {
          id: randomUUID(),
          publicId: p.id,
          user: user(p.name, p.email, 'PATIENT'),
          wallet: {
            balance: 1000
          }
        };
        patients.push(found);
      }
      Object.assign(found, {
        age: p.age,
        gender: p.gender,
        bloodGroup: p.blood,
        allergies: p.allergies,
        contact: p,
        primaryCase: p.case
      });
    }
    profiles.set(firstDoctor.user.id, structuredClone(fixture.profile));
    for (const p of fixture.patients.slice(0, 2)) {
      const patient = patients.find(item => item.publicId === p.id);
      const diagnosis = fixture.diagnoses.filter(d => d.patientId === p.id);
      const notes = fixture.notes.filter(n => n.patientId === p.id);
      const items = fixture.prescriptions.filter(r => r.patientId === p.id).map(r => ({
        ...r,
        drugName: fixture.medicines.find(m => m.id === r.medicineId).name,
        status: 'PENDING',
        dispensedAt: null
      }));
      sessions.push({
        id: `HISTORY-${p.id}`,
        status: 'FINALIZED',
        startedAt: `${diagnosis[0]?.date || today()}T09:00:00.000Z`,
        finalizedAt: `${diagnosis[0]?.date || today()}T09:30:00.000Z`,
        patient,
        doctor: firstDoctor,
        vitals: null,
        diagnosis: diagnosis.length ? {
          notes: diagnosis.map(d => d.notes).join('\n')
        } : null,
        uiDiagnoses: diagnosis,
        clinicalNotes: notes,
        prescription: {
          items
        }
      });
    }
  }
  function emit() {
    for (const listener of listeners) listener();
  }
  function accessible(u, p) {
    if (u.role === 'PATIENT') return p.user.id === u.id;
    if (u.role === 'PHARMACY') return pairing.canReadPatient(u.id, p.id) || scans.get(u.id)?.patientId === p.id && scans.get(u.id).expires > now();
    if (u.role === 'DOCTOR') return pairing.canReadPatient(u.id, p.id) || appointments.some(a => a.doctorId === u.id && a.patientId === p.publicId) || sessions.some(s => s.doctor.user.id === u.id && s.patient.id === p.id);
    if (u.role === 'HOSPITAL_ADMIN') {
      const h = hospitals.find(h => h.adminId === u.id);
      return doctors.filter(d => d.hospitalId === h?.id).some(d => accessible(d.user, p));
    }
    return false;
  }
  function patientFor(u, id) {
    const p = patients.find(p => p.publicId === id);
    if (!p || !accessible(u, p)) fail('FORBIDDEN', 'Connect this patient by QR or use an assigned appointment first.');
    return p;
  }
  function sessionFor(u, p, c, appointmentId) {
    const requested = appointmentId && appointments.find(a => a.id === appointmentId && a.doctorId === u.id && a.patientId === p.publicId && !['Completed', 'Cancelled'].includes(a.status));
    if (appointmentId && !requested) fail('BAD_USER_INPUT', 'Choose an open appointment belonging to this patient and doctor.');
    let s = sessions.find(s => s.patient.id === p.id && s.status === 'ACTIVE');
    if (s && s.doctor.user.id !== u.id) fail('FORBIDDEN', 'Another doctor is attending this patient.');
    if (!s) {
      // Reuse the engine's session checks; the workspace has already authorized the patient.
      s = root._startWorkspaceSession(p, c);
    }
    const a = appointments.find(a => a.doctorId === u.id && a.patientId === p.publicId && !['Completed', 'Cancelled'].includes(a.status) && (appointmentId ? a.id === appointmentId : a.date === today()));
    if (a) {
      s.appointmentId = a.id;
      a.status = 'In progress';
    }
    return s;
  }
  function snapshot(c) {
    const u = requireRole(c, ...allRoles);
    const visible = patients.filter(p => accessible(u, p));
    const ids = new Set(visible.map(p => p.id));
    const visibleSessions = sessions.filter(s => ids.has(s.patient.id));
    const meds = u.role === 'PHARMACY' ? inventory(u) : catalogue();
    const mappedPatients = visible.map(p => ({
      ...p.contact,
      id: p.publicId,
      name: p.user.name,
      age: p.age ?? 0,
      gender: p.gender || 'Not recorded',
      blood: p.bloodGroup || 'Not recorded',
      phone: p.contact?.phone || '',
      email: p.user.identifier,
      case: p.primaryCase || 'General checkup',
      allergies: p.allergies || 'None known',
      color: p.contact?.color || 'mint'
    }));
    const diagnoses = visibleSessions.flatMap(s => s.uiDiagnoses || (s.diagnosis ? [{
      id: `DX-${s.id}`,
      patientId: s.patient.publicId,
      name: 'Clinical assessment',
      code: '',
      notes: s.diagnosis.notes,
      date: s.startedAt.slice(0, 10)
    }] : []));
    const notes = visibleSessions.flatMap(s => s.clinicalNotes || []);
    const rx = visibleSessions.filter(s => u.role !== 'PHARMACY' || s.status === 'FINALIZED').flatMap(s => (s.prescription?.items || []).map(i => {
      const medicine = meds.find(m => m.name.toLowerCase() === i.drugName.toLowerCase());
      return {
        id: i.id,
        patientId: s.patient.publicId,
        medicineId: medicine?.id || `external:${i.drugName}`,
        quantity: i.quantity,
        dosage: i.dosage,
        duration: i.duration || 'As prescribed',
        instructions: i.instructions || '',
        status: i.status === 'DISPENSED' ? 'Dispensed' : 'Pending',
        date: s.startedAt.slice(0, 10),
        sessionId: s.id,
        finalized: s.status === 'FINALIZED'
      };
    }));
    // External prescriptions still render safely; the pharmacist must add stock before serving.
    const missing = rx.filter(r => !meds.some(m => m.id === r.medicineId)).map(r => ({
      id: r.medicineId,
      name: r.medicineId.slice(9),
      generic: 'External prescription',
      category: 'Other',
      strength: '',
      stock: 0,
      threshold: 0,
      price: 0,
      expiry: '2099-12-31'
    }));
    const pharmacy = pharmacies.find(p => p.userId === u.id),
      hospital = hospitals.find(h => h.adminId === u.id || h.id === doctors.find(d => d.user.id === u.id)?.hospitalId);
    const balance = u.role === 'PATIENT' ? patients.find(p => p.user.id === u.id)?.wallet.balance : u.role === 'PHARMACY' ? pharmacy?.wallet.balance : hospital?.wallet.balance;
    return {
      patients: mappedPatients,
      appointmentProviders: u.role === 'PATIENT' && u.profileComplete ? doctors.flatMap(d => {
        const h = hospitals.find(h => h.id === d.hospitalId);
        return h ? [{ id: d.user.id, name: d.user.name, hospitalId: h.id, hospitalName: h.name, consultationFee: h.consultationFee }] : [];
      }) : [],
      appointments: appointments.filter(a => mappedPatients.some(p => p.id === a.patientId) && (u.role === 'DOCTOR' ? a.doctorId === u.id : u.role === 'HOSPITAL_ADMIN' ? doctors.some(d => d.user.id === a.doctorId && d.hospitalId === hospital?.id) : true)).map(a => {
        const d = doctors.find(d => d.user.id === a.doctorId);
        return { ...a, doctorName: d?.user.name || 'Doctor', hospitalName: hospitals.find(h => h.id === d?.hospitalId)?.name || 'Hospital' };
      }),
      medicines: [...new Map([...meds, ...missing].map(m => [m.id, m])).values()],
      prescriptions: rx,
      diagnoses,
      notes,
      movements: u.role === 'PHARMACY' ? movements.get(u.id) || [] : [],
      profile: profiles.get(u.id) || {
        name: u.name,
        email: u.identifier,
        phone: '',
        specialty: u.role === 'DOCTOR' ? 'General Practitioner' : u.role === 'PHARMACY' ? 'Pharmacist' : 'Care team',
        bio: '',
        available: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      },
      sessions: visibleSessions.map(s => ({
        id: s.id,
        patientId: s.patient.publicId,
        doctorId: s.doctor.user.id,
        status: s.status,
        appointmentId: s.appointmentId || null,
        vitals: s.vitals
      })),
      accessExpiresAt: u.role === 'PHARMACY' ? Math.min(...[...root.myPairings({}, c).filter(p => p.status === 'APPROVED').map(p => Date.parse(p.connectionExpiresAt)), scans.get(u.id)?.expires].filter(n => n && n > now())) || null : null,
      wallet: balance ?? 0,
      hospitalName: hospital?.name || pharmacy?.name || 'Emerald Care',
      payments: payments.filter(p => u.role === 'PATIENT' ? p.patientId === patients.find(p => p.user.id === u.id)?.id : u.role === 'PHARMACY' ? p.providerId === u.id : u.role === 'DOCTOR' ? p.providerId === u.id : u.role === 'HOSPITAL_ADMIN' ? doctors.some(d => d.hospitalId === hospital?.id && d.user.id === p.providerId) : false).map(p => ({
        id: p.id,
        kind: p.kind,
        amount: p.amount,
        balance: p.balance,
        occurredAt: p.occurredAt
      }))
    };
  }
  const serviceRoot = {
    myWorkspace: (_, c) => snapshot(c),
    workspaceAction: ({
      kind,
      input
    }, c) => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) fail('BAD_USER_INPUT', 'Invalid action input.');
      const pharmacyActions = ['ADD_MEDICINE', 'RECEIVE_STOCK', 'DISPENSE', 'VERIFY_PATIENT'];
      const u = requireRole(c, ...(pharmacyActions.includes(kind) ? ['PHARMACY'] : ['ADD_APPOINTMENT', 'UPDATE_APPOINTMENT'].includes(kind) ? ['DOCTOR', 'PATIENT'] : ['DOCTOR']));
      if (kind === 'ADD_APPOINTMENT') {
        const patient = patientFor(u, input.patientId);
        if (u.role === 'PATIENT' && !u.profileComplete) fail('FORBIDDEN', 'Complete your patient profile before booking an appointment.');
        const selectedDoctor = u.role === 'PATIENT' ? doctors.find(d => d.user.id === input.doctorId) : doctors.find(d => d.user.id === u.id);
        if (!selectedDoctor || !hospitals.some(h => h.id === selectedDoctor.hospitalId)) fail('BAD_USER_INPUT', 'Choose a valid doctor and hospital.');
        if (u.role === 'DOCTOR' && input.doctorId && input.doctorId !== u.id) fail('FORBIDDEN', 'You can only book appointments in your own schedule.');
        const day = date(input.date);
        if (day < today() || !/^(0[89]|1[0-6]):(00|15|30|45)$/.test(input.time) || input.time < '08:00' || input.time > '16:30' || Number(input.time.slice(3)) % 15) fail('BAD_USER_INPUT', 'Choose a future appointment in practice hours.');
        const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        if (appointments.some(a => (a.doctorId === selectedDoctor.user.id || a.patientId === patient.publicId) && a.date === day && a.status !== 'Cancelled' && Math.abs(minutes(a.time) - minutes(input.time)) < 30)) fail('APPOINTMENT_CONFLICT', 'This time is already booked or overlaps an existing visit. Choose another slot.');
        appointments.push({
          id: randomUUID(),
          doctorId: selectedDoctor.user.id,
          patientId: patient.publicId,
          date: day,
          time: input.time,
          type: text(input.type, 'visit type', 100),
          reason: text(input.reason, 'reason', 500),
          status: 'Confirmed'
        });
      } else if (kind === 'UPDATE_APPOINTMENT') {
        const a = appointments.find(a => a.id === input.id && (u.role === 'DOCTOR' ? a.doctorId === u.id : patients.some(p => p.user.id === u.id && p.publicId === a.patientId)));
        if (u.role === 'PATIENT' && input.status !== 'Cancelled') fail('FORBIDDEN', 'Patients can only cancel their own appointments.');
        if (!a) fail('NOT_FOUND', 'Appointment not found.');
        if (['Completed', 'Cancelled'].includes(a.status)) fail('VISIT_CLOSED', 'This appointment is already closed.');
        if (input.status === 'Cancelled') {
          if (a.status === 'In progress') fail('VISIT_ACTIVE', 'Complete the active consultation before closing its appointment.');
          a.status = 'Cancelled';
        } else if (input.status === 'In progress') sessionFor(u, patientFor(u, a.patientId), c, a.id);else if (input.status === 'Completed') {
          const s = sessions.find(s => s.appointmentId === a.id && s.status === 'ACTIVE' && s.doctor.user.id === u.id);
          if (!s) fail('SESSION_NOT_ACTIVE', 'Start the visit before completing it.');
          root.finalizeSession({
            sessionId: s.id
          }, c);
        } else fail('BAD_USER_INPUT', 'Unsupported appointment transition.');
      } else if (kind === 'START_VISIT') sessionFor(u, patientFor(u, input.patientId), c, input.appointmentId);else if (['ADD_DIAGNOSIS', 'ADD_PRESCRIPTION', 'SAVE_NOTE', 'SAVE_VITALS'].includes(kind)) {
        const p = patientFor(u, input.patientId);
        const s = sessions.find(s => s.patient.id === p.id && s.doctor.user.id === u.id && s.status === 'ACTIVE');
        if (!s) fail('SESSION_NOT_ACTIVE', 'Start this patient’s visit before saving clinical information.');
        if (kind === 'ADD_DIAGNOSIS') {
          const d = {
            id: randomUUID(),
            patientId: p.publicId,
            name: text(input.name, 'diagnosis', 150),
            code: String(input.code || '').slice(0, 20),
            notes: text(input.notes, 'clinical assessment', 3000),
            date: today()
          };
          s.uiDiagnoses ||= [];
          s.uiDiagnoses.push(d);
          root.recordDiagnosis({
            sessionId: s.id,
            input: {
              notes: s.uiDiagnoses.map(d => `${d.name}${d.code ? ` (${d.code})` : ''}: ${d.notes}`).join('\n')
            }
          }, c);
          p.primaryCase = d.name;
        } else if (kind === 'ADD_PRESCRIPTION') {
          const med = catalogue().find(m => m.id === input.medicineId);
          if (!med) fail('NOT_FOUND', 'Medicine not found.');
          const duration = text(input.duration, 'duration', 80),
            instructions = String(input.instructions || '').slice(0, 2000);
          const item = {
            drugName: med.name,
            dosage: text(input.dosage, 'dosage', 200),
            quantity: integer(input.quantity, 'quantity')
          };
          const old = s.prescription?.items || [];
          root.createPrescription({
            sessionId: s.id,
            input: {
              items: [...old.map(i => ({
                drugName: i.drugName,
                dosage: i.dosage,
                quantity: i.quantity
              })), item]
            }
          }, c);
          s.prescription.items.forEach((i, n) => Object.assign(i, n < old.length ? {
            duration: old[n].duration,
            instructions: old[n].instructions
          } : {
            duration,
            instructions
          }));
        } else if (kind === 'SAVE_VITALS') {
          const vitals = input.vitals;
          if (!vitals || typeof vitals !== 'object' || Array.isArray(vitals)) fail('BAD_USER_INPUT', 'Enter valid vitals.');
          const names = ['bloodPressure', 'heartRate', 'temperature', 'oxygenSaturation', 'weight'];
          for (const [name, value] of Object.entries(vitals)) {
            if (!names.includes(name)) fail('BAD_USER_INPUT', 'Unknown vital field.');
            if (value == null) continue;
            if (name === 'bloodPressure') {
              if (typeof value !== 'string' || value.length > 40) fail('BAD_USER_INPUT', 'Enter valid blood pressure.');
            } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || ['heartRate', 'oxygenSaturation'].includes(name) && !Number.isInteger(value)) fail('BAD_USER_INPUT', 'Enter valid numeric measurements.');
          }
          root.recordVitals({
            sessionId: s.id,
            input: vitals
          }, c);
        } else {
          s.clinicalNotes ||= [];
          s.clinicalNotes.push({
            id: randomUUID(),
            patientId: p.publicId,
            text: text(input.text, 'clinical note'),
            date: today()
          });
        }
        pairing.notifyPatient(p.id);
      } else if (kind === 'SAVE_PROFILE') {
        const profile = {
          name: text(input.name, 'name', 100),
          email: u.identifier,
          phone: text(input.phone, 'phone', 40),
          specialty: text(input.specialty, 'specialty', 100),
          bio: text(input.bio, 'biography', 1500),
          available: input.available
        };
        if (!Array.isArray(profile.available) || profile.available.some(d => !['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(d))) fail('BAD_USER_INPUT', 'Choose valid availability days.');
        profiles.set(u.id, profile);
        u.name = profile.name;
      } else if (kind === 'ADD_MEDICINE') {
        const items = inventory(u),
          name = text(input.name, 'medicine name', 100),
          strength = text(input.strength, 'strength', 50);
        if (items.some(m => m.name.toLowerCase() === name.toLowerCase() && m.strength.toLowerCase() === strength.toLowerCase())) fail('BAD_USER_INPUT', 'This medicine and strength already exist. Receive stock instead.');
        if (!Number.isFinite(input.price) || input.price < 0 || input.price > 100000) fail('BAD_USER_INPUT', 'Enter a valid unit price.');
        if (date(input.expiry) < today()) fail('BAD_USER_INPUT', 'Medicine expiry must be today or later.');
        const med = {
          id: randomUUID(),
          name,
          strength,
          generic: text(input.generic, 'generic name', 150),
          category: text(input.category, 'category', 100),
          stock: integer(input.stock, 'stock', 0),
          threshold: integer(input.threshold, 'threshold', 0),
          price: Math.round(input.price * 100) / 100,
          expiry: input.expiry
        };
        items.push(med);
        root.setPharmacyDrugPrice({
          input: {
            drugName: name,
            price: med.price
          }
        }, c);
        if (!movements.has(u.id)) movements.set(u.id, []);
        movements.get(u.id).push({
          id: randomUUID(),
          medicineId: med.id,
          quantity: med.stock,
          type: 'Stock received',
          date: today(),
          reference: 'New medicine'
        });
      } else if (kind === 'RECEIVE_STOCK') {
        const med = inventory(u).find(m => m.id === input.id);
        if (!med) fail('NOT_FOUND', 'Medicine not found in your pharmacy.');
        const quantity = integer(input.quantity, 'quantity');
        med.stock += quantity;
        if (!movements.has(u.id)) movements.set(u.id, []);
        movements.get(u.id).push({
          id: randomUUID(),
          medicineId: med.id,
          quantity,
          type: 'Stock received',
          date: today(),
          reference: 'Stock replenishment'
        });
      } else if (kind === 'DISPENSE') root.dispensePrescriptionItem({
        itemId: input.id
      }, c);else if (kind === 'VERIFY_PATIENT') {
        const p = patientByToken(text(input.token, 'QR token', 500));
        scans.set(u.id, {
          patientId: p.id,
          expires: now() + 120000
        });
      }
      emit();
      return snapshot(c);
    },
    workspaceChanged: (_, c) => {
      requireRole(c, ...allRoles);
      let waiting,
        pending = false,
        closed = false;
      const listener = () => {
        if (waiting) {
          const resolve = waiting;
          waiting = null;
          resolve({
            value: {
              workspaceChanged: true
            },
            done: false
          });
        } else pending = true;
      };
      listeners.add(listener);
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next() {
          if (closed) return Promise.resolve({
            done: true
          });
          if (pending) {
            pending = false;
            return Promise.resolve({
              value: {
                workspaceChanged: true
              },
              done: false
            });
          }
          return new Promise(resolve => {
            waiting = resolve;
          });
        },
        return() {
          closed = true;
          listeners.delete(listener);
          waiting?.({
            done: true
          });
          return Promise.resolve({
            done: true
          });
        }
      };
    }
  };
  // Intercept the existing clinical API too: both interfaces debit the same stock,
  // wallets and appointments, with identical checks before any financial mutation.
  const originalDispense = root.dispensePrescriptionItem;
  root.dispensePrescriptionItem = (args, c) => {
    const u = requireRole(c, 'PHARMACY');
    const s = sessions.find(s => s.prescription?.items.some(i => i.id === args.itemId));
    const item = s?.prescription.items.find(i => i.id === args.itemId);
    let med;
    if (enabled) {
      if (!s || !accessible(u, s.patient)) fail('FORBIDDEN', 'Connect the patient before serving this prescription.');
      med = inventory(u).find(m => m.name.toLowerCase() === item.drugName.toLowerCase());
      if (!med || med.stock < item.quantity) fail('INSUFFICIENT_STOCK', 'Insufficient stock. Add medicine or receive stock before dispensing.');
      if (med.expiry < today()) fail('MEDICINE_EXPIRED', 'This medicine has expired.');
    }
    const result = originalDispense(args, c);
    if (med) {
      med.stock -= item.quantity;
      if (!movements.has(u.id)) movements.set(u.id, []);
      movements.get(u.id).push({
        id: randomUUID(),
        medicineId: med.id,
        quantity: item.quantity,
        type: 'Dispensed',
        date: today(),
        reference: item.id
      });
    }
    emit();
    return result;
  };
  const originalFinalize = root.finalizeSession;
  root.finalizeSession = (args, c) => {
    const result = originalFinalize(args, c);
    const a = appointments.find(a => a.id === result.appointmentId);
    if (a) a.status = 'Completed';
    emit();
    return result;
  };
  const originalPrice = root.setPharmacyDrugPrice;
  root.setPharmacyDrugPrice = (args, c) => {
    const result = originalPrice(args, c),
      u = requireRole(c, 'PHARMACY');
    for (const m of inventory(u)) if (m.name.toLowerCase() === result.drugName.toLowerCase()) m.price = result.price;
    emit();
    return result;
  };
  const originalPending = root.pendingPrescriptionItems;
  root.pendingPrescriptionItems = (args, c) => {
    const result = originalPending(args, c),
      u = requireRole(c, 'PHARMACY'),
      p = patientByToken(args.qrToken);
    scans.set(u.id, {
      patientId: p.id,
      expires: now() + 120000
    });
    return result;
  };
  for (const name of ['approveLoginQr', 'revokePairing', 'createLoginQr', 'recordVitals', 'recordDiagnosis', 'createPrescription', 'topUpWallet', 'completePatientProfile', 'onboardDoctor', 'onboardHospital', 'onboardPharmacy', 'startSession', 'startPairedSession']) {
    const original = root[name];
    root[name] = (args, c) => {
      const result = original(args, c);
      emit();
      return result;
    };
  }
  return {
    root: serviceRoot
  };
}

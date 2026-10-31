import { createHash, randomBytes, randomUUID } from 'node:crypto';

// A pairing challenge is single-use; the resulting connection is a separate,
// revocable, short-lived grant. No access/refresh token is encoded in its QR.
export function createPairingService({
  now,
  requireRole,
  patientOf,
  pendingItems,
  paymentRecords,
  startSession,
  dispense,
  fail,
  scanOrigin,
  qrTtl = 120_000,
  connectionTtl = 30 * 60_000
}) {
  const connections = new Map(),
    challenges = new Map(),
    listeners = new Map();
  const digest = token => createHash('sha256').update(token).digest('hex');
  const iso = value => new Date(value).toISOString();
  function status(pair) {
    if (pair.state === 'WAITING' && pair.claimExpires <= now()) return 'EXPIRED';
    if (pair.state === 'APPROVED' && pair.connectionExpires <= now()) return 'EXPIRED';
    return pair.state;
  }
  function view(pair) {
    const active = status(pair) === 'APPROVED';
    return {
      id: pair.id,
      status: status(pair),
      provider: pair.provider,
      expiresAt: iso(pair.claimExpires),
      connectionExpiresAt: pair.connectionExpires ? iso(pair.connectionExpires) : null,
      approvedAt: pair.approvedAt ? iso(pair.approvedAt) : null,
      patient: active ? pair.patient : null,
      pendingItems: active ? pendingItems(pair.patient) : [],
      payments: active ? paymentRecords(pair.patient, pair.provider.id) : []
    };
  }
  function owned(id, context) {
    const user = requireRole(context, 'DOCTOR', 'PHARMACY', 'PATIENT');
    const pair = connections.get(id);
    if (!pair) fail('NOT_FOUND', 'Patient connection not found.');
    if (pair.provider.id !== user.id && pair.patient?.user.id !== user.id) fail('FORBIDDEN', 'This connection belongs to another account.');
    return pair;
  }
  function active(id, context, role) {
    const user = requireRole(context, role);
    const pair = owned(id, context);
    if (pair.provider.id !== user.id) fail('FORBIDDEN', 'Only the paired provider can perform this action.');
    if (status(pair) !== 'APPROVED') fail('CONNECTION_CLOSED', 'This patient connection has ended. Generate a new login QR.');
    return pair;
  }
  function emit(pair) {
    for (const fn of listeners.get(pair.id) || []) fn({
      pairingUpdated: view(pair)
    });
  }
  function challenge(token) {
    const pair = challenges.get(digest(token));
    if (!pair) fail('TOKEN_NOT_FOUND', 'This login QR is invalid. Ask for a new code.');
    if (pair.state === 'APPROVED' || pair.patient) fail('PAIRING_ALREADY_USED', 'This one-time login QR has already been used. Ask for a new code.');
    if (status(pair) === 'EXPIRED') fail('TOKEN_EXPIRED', 'This login QR has expired. Ask the doctor or pharmacy for a new code.');
    if (pair.state !== 'WAITING') fail('CONNECTION_CLOSED', 'This login QR was cancelled. Ask for a new code.');
    return pair;
  }
  const root = {
    createLoginQr: (_, context) => {
      const provider = requireRole(context, 'DOCTOR', 'PHARMACY');
      for (const pair of connections.values()) if (pair.provider.id === provider.id && ['WAITING', 'APPROVED'].includes(status(pair))) {
        pair.state = 'REVOKED';
        emit(pair);
      }
      const token = randomBytes(32).toString('base64url');
      const pair = {
        id: randomUUID(),
        provider,
        state: 'WAITING',
        claimExpires: now() + qrTtl,
        patient: null,
        approvedAt: null,
        connectionExpires: null
      };
      connections.set(pair.id, pair);
      challenges.set(digest(token), pair);
      return {
        connection: view(pair),
        token,
        pairingUrl: `${scanOrigin.replace(/\/$/, '')}/portal/#pair=${encodeURIComponent(token)}&mode=simulation`
      };
    },
    previewLoginQr: ({
      token
    }, context) => {
      requireRole(context, 'PATIENT');
      const pair = challenge(token);
      return {
        id: pair.id,
        provider: pair.provider,
        expiresAt: iso(pair.claimExpires)
      };
    },
    approveLoginQr: ({
      token
    }, context) => {
      const user = requireRole(context, 'PATIENT');
      if (!user.profileComplete) fail('FORBIDDEN', 'Complete your patient profile before connecting.');
      const pair = challenge(token);
      // The check and consumption are synchronous, before emitting any events.
      pair.patient = patientOf(user.id);
      pair.state = 'APPROVED';
      pair.approvedAt = now();
      pair.connectionExpires = now() + connectionTtl;
      emit(pair);
      return view(pair);
    },
    pairingConnection: ({
      id
    }, context) => view(owned(id, context)),
    myPairings: (_, context) => {
      const user = requireRole(context, 'PATIENT', 'DOCTOR', 'PHARMACY');
      return [...connections.values()].filter(pair => pair.provider.id === user.id || pair.patient?.user.id === user.id).map(view);
    },
    revokePairing: ({
      id
    }, context) => {
      const pair = owned(id, context);
      pair.state = 'REVOKED';
      emit(pair);
      return view(pair);
    },
    startPairedSession: ({
      connectionId
    }, context) => startSession(active(connectionId, context, 'DOCTOR').patient, context),
    dispensePairedItem: ({
      connectionId,
      itemId
    }, context) => {
      const pair = active(connectionId, context, 'PHARMACY');
      if (!pendingItems(pair.patient).some(item => item.id === itemId)) fail('NOT_FOUND', 'This pending item does not belong to the connected patient. Refresh the shared information.');
      return dispense(itemId, context);
    },
    pairingUpdated: ({
      connectionId
    }, context) => {
      const pair = owned(connectionId, context),
        queue = [];
      let waiting,
        closed = false;
      const handler = event => {
        if (closed) return;
        if (waiting) {
          const resolve = waiting;
          waiting = null;
          resolve({
            value: event,
            done: false
          });
        } else {
          queue.length = 0;
          queue.push(event);
        }
      };
      if (!listeners.has(pair.id)) listeners.set(pair.id, new Set());
      listeners.get(pair.id).add(handler);
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
          return new Promise(resolve => {
            waiting = resolve;
          });
        },
        return() {
          closed = true;
          listeners.get(pair.id).delete(handler);
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
  return {
    root,
    canReadPatient(userId, patientId) {
      return [...connections.values()].some(pair => pair.provider.id === userId && pair.patient?.id === patientId && status(pair) === 'APPROVED');
    },
    notifyPatient(patientId) {
      for (const pair of connections.values()) if (pair.patient?.id === patientId && status(pair) === 'APPROVED') emit(pair);
    }
  };
}

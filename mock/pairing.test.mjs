import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql, subscribe, parse } from 'graphql';
import { createSimulation, schema } from './engine.mjs';
function setup() {
  let clock = Date.now();
  const engine = createSimulation({
    now: () => clock
  });
  const run = (query, variables = {}, accessToken = '') => graphql({
    schema,
    source: query,
    variableValues: variables,
    rootValue: engine.root,
    contextValue: {
      accessToken
    },
    fieldResolver: engine.fieldResolver
  });
  const login = async identifier => (await run('mutation($identifier:String!){verifyOtp(input:{identifier:$identifier,otp:"000000"}){accessToken}}', {
    identifier
  })).data.verifyOtp.accessToken;
  return {
    engine,
    run,
    login,
    advance: amount => {
      clock += amount;
    }
  };
}
const create = 'mutation{createLoginQr{token pairingUrl connection{id status patient{id}}}}';
const approve = 'mutation($token:String!){approveLoginQr(token:$token){id status patient{publicId wallet{balance}}}}';
const preview = 'query($token:String!){previewLoginQr(token:$token){id provider{name role}}}';
const read = 'query($id:ID!){pairingConnection(id:$id){id status patient{id user{name} sessions{id diagnosis{notes}} wallet{balance}} pendingItems{id} payments{kind amount}}}';
const revoke = 'mutation($id:ID!){revokePairing(id:$id){status patient{id}}}';
const start = 'mutation($id:ID!){startPairedSession(connectionId:$id){id status}}';
const error = result => result.errors?.[0]?.extensions?.code;
test('login QR needs patient consent, is single use and exposes no records before approval', async () => {
  const {
    run,
    login
  } = setup();
  const d = await login('doctor@emerald.care'),
    p = await login('patient@emerald.care'),
    other = await login('new.patient@emerald.care'),
    ph = await login('pharmacy@emerald.care');
  assert.equal(error(await run(create)), 'UNAUTHENTICATED');
  assert.equal(error(await run(create, {}, p)), 'FORBIDDEN');
  const qr = (await run(create, {}, d)).data.createLoginQr;
  assert.match(qr.token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(qr.pairingUrl.includes('#pair='));
  assert.ok(!qr.pairingUrl.includes(d));
  assert.equal(qr.connection.patient, null);
  assert.equal((await run(preview, {
    token: qr.token
  }, p)).data.previewLoginQr.provider.role, 'DOCTOR');
  assert.equal(error(await run(preview, {
    token: qr.token
  }, d)), 'FORBIDDEN');
  assert.equal(error(await run(read, {
    id: qr.connection.id
  }, ph)), 'FORBIDDEN');
  assert.equal(error(await run(approve, {
    token: qr.token
  }, other)), 'FORBIDDEN');
  const before = (await run('{myPatientProfile{wallet{balance}}}', {}, p)).data.myPatientProfile.wallet.balance;
  const result = await run(approve, {
    token: qr.token
  }, p);
  assert.equal(result.data.approveLoginQr.status, 'APPROVED');
  assert.equal(result.data.approveLoginQr.patient.wallet.balance, before);
  const replays = await Promise.all([run(approve, {
    token: qr.token
  }, p), run(approve, {
    token: qr.token
  }, p)]);
  replays.forEach(result => assert.equal(error(result), 'PAIRING_ALREADY_USED'));
  assert.equal((await run(read, {
    id: qr.connection.id
  }, d)).data.pairingConnection.patient.user.name, 'Olivia Rhye');
  assert.equal(error(await run(read, {
    id: qr.connection.id
  }, other)), 'FORBIDDEN');
  await run(revoke, {
    id: qr.connection.id
  }, p);
  const closed = (await run(read, {
    id: qr.connection.id
  }, d)).data.pairingConnection;
  assert.equal(closed.status, 'REVOKED');
  assert.equal(closed.patient, null);
  assert.deepEqual(closed.payments, []);
  assert.equal(error(await run(start, {
    id: qr.connection.id
  }, d)), 'CONNECTION_CLOSED');
});
test('challenge expiration, regeneration and connection expiry are enforced by the server', async () => {
  const {
    run,
    login,
    advance
  } = setup();
  const d = await login('doctor@emerald.care'),
    p = await login('patient@emerald.care');
  const old = (await run(create, {}, d)).data.createLoginQr;
  advance(120001);
  assert.equal(error(await run(approve, {
    token: old.token
  }, p)), 'TOKEN_EXPIRED');
  const replaced = (await run(create, {}, d)).data.createLoginQr;
  const fresh = (await run(create, {}, d)).data.createLoginQr;
  assert.equal(error(await run(approve, {
    token: replaced.token
  }, p)), 'CONNECTION_CLOSED');
  await run(approve, {
    token: fresh.token
  }, p);
  advance(120001);
  assert.equal((await run(start, {
    id: fresh.connection.id
  }, d)).data.startPairedSession.status, 'ACTIVE');
  // Refresh login after moving beyond the access TTL to test the connection TTL separately.
  advance(30 * 60000);
  const reauthenticated = await login('doctor@emerald.care');
  const expired = (await run(read, {
    id: fresh.connection.id
  }, reauthenticated)).data.pairingConnection;
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.patient, null);
  assert.equal(error(await run(start, {
    id: fresh.connection.id
  }, reauthenticated)), 'CONNECTION_CLOSED');
});
test('paired pharmacy reads records, serves only its connected patient and shares payment status', async () => {
  const {
    run,
    login
  } = setup();
  const d = await login('doctor@emerald.care'),
    p = await login('patient@emerald.care'),
    ph = await login('pharmacy@emerald.care');
  const doctorQr = (await run(create, {}, d)).data.createLoginQr;
  await run(approve, {
    token: doctorQr.token
  }, p);
  const session = (await run(start, {
    id: doctorQr.connection.id
  }, d)).data.startPairedSession.id;
  await run('mutation($id:ID!){recordDiagnosis(sessionId:$id,input:{notes:"Shared clinical assessment"}){id}}', {
    id: session
  }, d);
  await run('mutation($id:ID!){createPrescription(sessionId:$id,input:{items:[{drugName:"Amlodipine",dosage:"Simulated instructions",quantity:10}]}){id}}', {
    id: session
  }, d);
  await run('mutation($id:ID!){finalizeSession(sessionId:$id){status}}', {
    id: session
  }, d);
  const pharmacyQr = (await run(create, {}, ph)).data.createLoginQr;
  await run(approve, {
    token: pharmacyQr.token
  }, p);
  const connected = (await run(read, {
    id: pharmacyQr.connection.id
  }, ph)).data.pairingConnection;
  assert.equal(connected.patient.sessions[0].diagnosis.notes, 'Shared clinical assessment');
  assert.equal(connected.payments.length, 0); // The doctor's payment isn't exposed to a different provider.
  const item = connected.pendingItems[0].id;
  const dispense = 'mutation($connection:ID!,$item:ID!){dispensePairedItem(connectionId:$connection,itemId:$item){status}}';
  assert.equal(error(await run(dispense, {
    connection: pharmacyQr.connection.id,
    item: 'somebody-elses-item'
  }, ph)), 'NOT_FOUND');
  assert.equal(error(await run(dispense, {
    connection: pharmacyQr.connection.id,
    item
  }, d)), 'FORBIDDEN');
  assert.equal((await run(dispense, {
    connection: pharmacyQr.connection.id,
    item
  }, ph)).data.dispensePairedItem.status, 'DISPENSED');
  const paid = (await run(read, {
    id: pharmacyQr.connection.id
  }, ph)).data.pairingConnection;
  assert.equal(paid.payments.length, 1);
  assert.equal(paid.payments[0].amount, -25);
  assert.equal(paid.patient.wallet.balance, 825);
  const other = await login('new.patient@emerald.care');
  await run('mutation{completePatientProfile(input:{name:"Other Patient",age:35,gender:"Male"}){id}}', {}, other);
  const secondQr = (await run(create, {}, d)).data.createLoginQr;
  await run(approve, {
    token: secondQr.token
  }, other);
  await run(start, {
    id: secondQr.connection.id
  }, d);
  const nested = await run('query($id:ID!){pairingConnection(id:$id){patient{sessions{doctor{sessions{patient{publicId}}}}}}}', {
    id: pharmacyQr.connection.id
  }, ph);
  const nestedPatients = nested.data.pairingConnection.patient.sessions.flatMap(s => s.doctor.sessions.map(s => s.patient.publicId));
  assert.ok(nestedPatients.length);
  assert.ok(nestedPatients.every(id => id === 'PT-1001'));
  await run(revoke, {
    id: pharmacyQr.connection.id
  }, p);
  assert.equal(error(await run(dispense, {
    connection: pharmacyQr.connection.id,
    item
  }, ph)), 'CONNECTION_CLOSED');
});
test('pairing subscriptions are owner scoped and notify staff of approval and revocation', async () => {
  const {
    engine,
    run,
    login
  } = setup();
  const d = await login('doctor@emerald.care'),
    p = await login('patient@emerald.care'),
    ph = await login('pharmacy@emerald.care');
  const qr = (await run(create, {}, d)).data.createLoginQr;
  const args = {
    schema,
    document: parse('subscription($id:ID!){pairingUpdated(connectionId:$id){id status}}'),
    variableValues: {
      id: qr.connection.id
    },
    rootValue: engine.root,
    fieldResolver: engine.fieldResolver,
    subscribeFieldResolver: engine.fieldResolver
  };
  const forbidden = await subscribe({
    ...args,
    contextValue: {
      accessToken: ph
    }
  });
  assert.equal(error(forbidden), 'FORBIDDEN');
  const stream = await subscribe({
    ...args,
    contextValue: {
      accessToken: d
    }
  });
  await run(approve, {
    token: qr.token
  }, p);
  assert.equal((await stream.next()).value.data.pairingUpdated.status, 'APPROVED');
  await run(revoke, {
    id: qr.connection.id
  }, p);
  assert.equal((await stream.next()).value.data.pairingUpdated.status, 'REVOKED');
  await stream.return();
});

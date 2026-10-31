import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql, parse, validate } from 'graphql';
import { readFileSync } from 'node:fs';
import { createSimulation, schema } from './engine.mjs';
const LOGIN = 'mutation($input: OtpVerificationInput!){verifyOtp(input:$input){accessToken refreshToken user{id role profileComplete}}}';
function setup(options) {
  const engine = createSimulation(options);
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
  const login = async identifier => (await run(LOGIN, {
    input: {
      identifier,
      otp: '000000'
    }
  })).data.verifyOtp;
  return {
    run,
    login
  };
}
const query = {
  qr: 'mutation{generateQrToken{token qrCodeUrl expiresAt}}',
  start: 'mutation($token:String!){startSession(qrToken:$token){id status}}',
  diagnosis: 'mutation($id:ID!,$notes:String!){recordDiagnosis(sessionId:$id,input:{notes:$notes}){id diagnosis{notes}}}',
  prescription: 'mutation($id:ID!,$items:[PrescriptionItemInput!]!){createPrescription(sessionId:$id,input:{items:$items}){prescription{items{id drugName quantity status}}}}',
  finalize: 'mutation($id:ID!){finalizeSession(sessionId:$id){status finalizedAt}}',
  pending: 'query($token:String!){pendingPrescriptionItems(qrToken:$token){id drugName quantity status}}',
  dispense: 'mutation($id:ID!){dispensePrescriptionItem(itemId:$id){status dispensedAt}}'
};
const code = result => result.errors?.[0].extensions.code;
test('OTP, access expiry and refresh are server validated', async () => {
  let time = Date.now();
  const {
    run,
    login
  } = setup({
    now: () => time
  });
  assert.equal((await run('mutation{requestOtp(input:{identifier:"unknown@example.test"})}')).data.requestOtp, true);
  assert.equal(code(await run(LOGIN, {
    input: {
      identifier: 'doctor@emerald.care',
      otp: '111111'
    }
  })), 'BAD_USER_INPUT');
  const doctor = await login('doctor@emerald.care');
  assert.equal((await run('{me{role}}', {}, doctor.accessToken)).data.me.role, 'DOCTOR');
  time += 15 * 60_000 + 1;
  assert.equal(code(await run('{me{role}}', {}, doctor.accessToken)), 'UNAUTHENTICATED');
  const refreshed = await run('mutation($token:String!){refreshToken(refreshToken:$token){accessToken}}', {
    token: doctor.refreshToken
  });
  assert.ok(refreshed.data.refreshToken.accessToken);
  assert.equal((await run('{me{role}}', {}, refreshed.data.refreshToken.accessToken)).data.me.role, 'DOCTOR');
  time += 7 * 86400_000;
  assert.equal(code(await run('mutation($token:String!){refreshToken(refreshToken:$token){accessToken}}', {
    token: doctor.refreshToken
  })), 'UNAUTHENTICATED');
});
test('QR rotation and expiry, role isolation and profile completion', async () => {
  let time = Date.now();
  const {
    run,
    login
  } = setup({
    now: () => time
  });
  const p = await login('patient@emerald.care');
  const d = await login('doctor@emerald.care');
  const old = (await run(query.qr, {}, p.accessToken)).data.generateQrToken;
  const fresh = (await run(query.qr, {}, p.accessToken)).data.generateQrToken;
  const lookup = 'query($token:String!){patientByQrToken(token:$token){publicId}}';
  assert.equal(code(await run(lookup, {
    token: old.token
  }, d.accessToken)), 'TOKEN_NOT_FOUND');
  assert.equal(code(await run(lookup, {
    token: fresh.token
  }, p.accessToken)), 'FORBIDDEN');
  time += 120_001;
  assert.equal(code(await run(lookup, {
    token: fresh.token
  }, d.accessToken)), 'TOKEN_EXPIRED');
  const incomplete = await login('new.patient@emerald.care');
  assert.equal(incomplete.user.profileComplete, false);
  assert.equal(code(await run(query.qr, {}, incomplete.accessToken)), 'FORBIDDEN');
  const complete = await run('mutation{completePatientProfile(input:{name:"New Person",age:22,gender:"Other"}){profileComplete}}', {}, incomplete.accessToken);
  assert.equal(complete.data.completePatientProfile.profileComplete, true);
  assert.ok((await run(query.qr, {}, incomplete.accessToken)).data.generateQrToken.token);
});
test('session upserts, financial recovery, finalization and dispensing are consistent', async () => {
  const {
    run,
    login
  } = setup();
  const p = await login('new.patient@emerald.care');
  const d = await login('doctor@emerald.care');
  const ph = await login('pharmacy@emerald.care');
  await run('mutation{completePatientProfile(input:{name:"Test Patient",age:30,gender:"Female"}){id}}', {}, p.accessToken);
  const token = (await run(query.qr, {}, p.accessToken)).data.generateQrToken.token;
  const start = await run(query.start, {
    token
  }, d.accessToken);
  const id = start.data.startSession.id;
  assert.equal(code(await run(query.start, {
    token
  }, d.accessToken)), 'SESSION_ALREADY_ACTIVE');
  await run(query.diagnosis, {
    id,
    notes: 'First draft'
  }, d.accessToken);
  const revised = await run(query.diagnosis, {
    id,
    notes: 'Revised assessment'
  }, d.accessToken);
  assert.equal(revised.data.recordDiagnosis.diagnosis.notes, 'Revised assessment');
  const items = [{
    drugName: 'Test medicine',
    dosage: 'Synthetic clinician instructions',
    quantity: 2
  }];
  await run(query.prescription, {
    id,
    items: [{
      ...items[0],
      quantity: 1
    }]
  }, d.accessToken);
  const rx = await run(query.prescription, {
    id,
    items
  }, d.accessToken);
  const item = rx.data.createPrescription.prescription.items[0];
  assert.equal(rx.data.createPrescription.prescription.items.length, 1);
  assert.equal(item.quantity, 2);
  assert.deepEqual((await run(query.pending, {
    token
  }, ph.accessToken)).data.pendingPrescriptionItems, []);
  assert.equal(code(await run(query.finalize, {
    id
  }, d.accessToken)), 'INSUFFICIENT_FUNDS');
  await run('mutation{topUpWallet(amount:150){balance}}', {}, p.accessToken);
  assert.equal((await run(query.finalize, {
    id
  }, d.accessToken)).data.finalizeSession.status, 'FINALIZED');
  assert.equal(code(await run(query.diagnosis, {
    id,
    notes: 'Locked'
  }, d.accessToken)), 'SESSION_NOT_ACTIVE');
  assert.equal((await run(query.pending, {
    token
  }, ph.accessToken)).data.pendingPrescriptionItems.length, 1);
  assert.equal(code(await run(query.dispense, {
    id: item.id
  }, ph.accessToken)), 'PRICE_NOT_SET');
  await run('mutation{setPharmacyDrugPrice(input:{drugName:"Test medicine",price:10}){price}}', {}, ph.accessToken);
  assert.equal(code(await run(query.dispense, {
    id: item.id
  }, ph.accessToken)), 'INSUFFICIENT_FUNDS');
  await run('mutation{topUpWallet(amount:20){balance}}', {}, p.accessToken);
  assert.equal((await run(query.dispense, {
    id: item.id
  }, ph.accessToken)).data.dispensePrescriptionItem.status, 'DISPENSED');
  assert.equal(code(await run(query.dispense, {
    id: item.id
  }, ph.accessToken)), 'ALREADY_DISPENSED');
  assert.equal((await run('{myPatientProfile{wallet{balance}}}', {}, p.accessToken)).data.myPatientProfile.wallet.balance, 0);
  assert.equal((await run('{myPharmacy{wallet{balance}}}', {}, ph.accessToken)).data.myPharmacy.wallet.balance, 20);
  assert.equal(code(await run('{allHospitals{id}}', {}, d.accessToken)), 'FORBIDDEN');
});
test('onboarding relationships and hospital isolation', async () => {
  const {
    run,
    login
  } = setup();
  const sys = await login('system@emerald.care');
  const create = await run('mutation{onboardHospital(input:{name:"Second Hospital",address:"Pretoria",consultationFee:75,adminName:"Other Admin",adminIdentifier:"other.admin@example.test"}){id name}}', {}, sys.accessToken);
  assert.equal(create.data.onboardHospital.name, 'Second Hospital');
  const admin = await login('other.admin@example.test');
  await run('mutation{onboardDoctor(input:{name:"Other Doctor",identifier:"other.doctor@example.test"}){id}}', {}, admin.accessToken);
  const doctors = await run('{myHospital{doctors{user{identifier}}} hospitalSessions{id}}', {}, admin.accessToken);
  assert.equal(doctors.data.myHospital.doctors.length, 1);
  assert.equal(doctors.data.myHospital.doctors[0].user.identifier, 'other.doctor@example.test');
  assert.equal(doctors.data.hospitalSessions.length, 0);
});
test('all frontend operation documents validate against the provisional schema', async () => {
  const source = readFileSync(new URL('../lib/backend/operations.ts', import.meta.url), 'utf8');
  const {
    operations,
    eventSelections
  } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const [name, document] of Object.entries(operations)) assert.deepEqual(validate(schema, parse(document)), [], name);
  for (const [name, fields] of Object.entries(eventSelections)) assert.deepEqual(validate(schema, parse(`subscription{${name}{${fields}}}`)), [], name);
});

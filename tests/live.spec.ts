import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildSchema, parse, validate } from 'graphql';
import { liveOperations } from '../lib/backend/live-operations';
import { SimulationClient } from '../lib/backend/client';
import { operations } from '../lib/backend/operations';
import { login } from './helpers';
const schema = buildSchema(readFileSync('backend/schema.live.graphql', 'utf8'));
const person = (role = 'DOCTOR') => ({ id: `u-${role}`, name: role === 'DOCTOR' ? 'Dr. Live Clinician' : role === 'PHARMACY' ? 'Live Pharmacist' : 'Live Patient', email: 'live@example.test', phone: null, role, profileComplete: true });
const patient = () => ({ id: 'p-live', publicId: 'LIVE-101', user: person('PATIENT'), dob: '1990-01-01T00:00:00Z', sex: 'Other', allergies: 'Penicillin', wallet: { balance: 1000, transactions: [] }, sessions: [] });
async function liveSignIn(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Live backend', exact: true })).toHaveClass(/primary/);
  await page.getByLabel('Email, phone or username').fill('live@example.test');
  await page.getByRole('button', { name: 'Request code', exact: true }).click();
  await page.getByLabel('One-time code').fill('123456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function fixture(page: Page, role: string) {
  const calls: string[] = [], requests: { query: string; variables: any }[] = [];
  const p = patient(), session: any = { id: 's-live', status: 'ACTIVE', startedAt: '2026-10-31T10:00:00Z', finalizedAt: null, patient: p, doctor: { id: 'd-live', user: person('DOCTOR') }, hospital: { id: 'h-live', name: 'Live Hospital', consultationFee: 150 }, vitals: null, diagnosis: null, prescription: null };
  let started = false, served = false;
  await page.route('**/api/backend/**', async route => {
    const { query, variables } = route.request().postDataJSON();
    expect(validate(schema, parse(query)).map(e => e.message)).toEqual([]);
    calls.push(query); requests.push({ query, variables });
    let data: any;
    if (query.includes('mutation RequestOtp')) data = { requestOtp: true };
    else if (query.includes('mutation VerifyOtp')) data = { verifyOtp: { accessToken: 'live-access', refreshToken: 'live-refresh', user: person(role) } };
    else if (query.includes('query Me')) data = { me: person(role) };
    else if (query.includes('query ActiveSession')) data = { myActiveSession: started && session.status === 'ACTIVE' ? session : null };
    else if (query.includes('query Session')) data = { session };
    else if (query.includes('query LookupPatient')) data = { patientByQrToken: { ...p, sessions: [] } };
    else if (query.includes('mutation Start')) { started = true; data = { startSession: session }; }
    else if (query.includes('mutation Vitals')) { session.vitals = { ...session.vitals, ...variables.input }; data = { recordVitals: session.vitals }; }
    else if (query.includes('mutation Diagnosis')) { session.diagnosis = { id: 'dx-live', code: variables.input.code, notes: variables.input.notes, recordedAt: '2026-10-31T10:00:00Z' }; data = { recordDiagnosis: session.diagnosis }; }
    else if (query.includes('mutation Prescription')) { session.prescription = { items: variables.input.items.map((i: any, n: number) => ({ ...i, id: `item-${n}`, status: 'PENDING', dispensedAt: null })) }; data = { createPrescription: session.prescription }; }
    else if (query.includes('mutation Finalize')) { session.status = 'FINALIZED'; data = { finalizeSession: session }; }
    else if (query.includes('query Pharmacy')) data = { myPharmacy: { id: 'ph-live', name: 'Live Pharmacy', address: null, wallet: { balance: served ? 60 : 50, transactions: [] }, drugPrices: [{ id: 'price-1', drugName: 'Test medicine', price: 2 }] } };
    else if (query.includes('query Pending')) data = { pendingPrescriptionItems: served ? [] : [{ id: 'live-item', drugName: 'Test medicine', dosage: 'Test instructions', quantity: 5, instructions: 'Test course', status: 'PENDING', dispensedAt: null }] };
    else if (query.includes('mutation Dispense')) { served = true; data = { dispensePrescriptionItem: { id: 'live-item', drugName: 'Test medicine', dosage: 'Test instructions', quantity: 5, instructions: 'Test course', status: 'DISPENSED', dispensedAt: '2026-10-31T10:30:00Z' } }; }
    else if (query.includes('query Patient')) data = { myPatientProfile: p };
    else if (query.includes('mutation GenerateQr')) data = { generateQrToken: { token: 'live-qr', qrCodeUrl: 'https://patient.example/scan/live-qr', expiresAt: new Date(Date.now() + 120000).toISOString() } };
    else throw Error('Unexpected live request: ' + query.slice(0, 100));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  return { calls, requests };
}
test('all live documents validate against the introspected backend schema', async () => {
  for (const [name, query] of Object.entries(liveOperations)) expect(validate(schema, parse(query)).map(e => e.message), name).toEqual([]);
});
test('live doctor scan, clinical forms and finalization use real schema shapes', async ({ page }) => {
  const { calls, requests } = await fixture(page, 'DOCTOR');
  await liveSignIn(page); await expect(page).toHaveURL(/dashboard/);
  await page.goto('/connections');
  await expect(page.getByRole('heading', { name: 'Generate a staff connection QR' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate connection QR' })).toBeDisabled();
  await expect(page.getByText(/ask the patient to sign in, open My care → My patient QR/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate login QR', exact: true })).toHaveCount(0);
  await page.getByLabel('Patient QR URL or token').fill('live-qr');
  await page.getByRole('button', { name: 'Verify patient QR', exact: true }).click();
  await page.getByRole('link', { name: 'Open consultation', exact: true }).click();
  await page.getByRole('button', { name: 'Start visit', exact: true }).click();
  await page.getByRole('button', { name: 'Record vitals', exact: true }).click();
  await page.getByLabel('Heart rate (bpm)').fill('73');
  await page.getByRole('button', { name: 'Save vitals', exact: true }).click();
  await expect(page.locator('.vitals-grid')).toContainText('73');
  expect(requests.find(r => r.query.includes('mutation Vitals'))?.variables.input).toEqual({ sessionId: 's-live', bloodPressure: null, pulse: 73, weightKg: null, temperature: null });
  await page.getByRole('button', { name: 'Add diagnosis', exact: true }).click();
  await page.getByLabel('Diagnosis', { exact: true }).fill('Live assessment');
  await page.getByLabel('Clinical assessment').fill('Live clinical notes');
  await page.getByRole('button', { name: 'Save diagnosis', exact: true }).click();
  await page.getByRole('button', { name: 'Add prescription', exact: true }).click();
  await page.getByLabel('Medicine', { exact: true }).fill('Test medicine');
  await page.getByLabel('Dosage / frequency').fill('Clinician instructions');
  await page.getByLabel('Quantity', { exact: true }).fill('5');
  await page.getByLabel('Duration', { exact: true }).fill('Test duration');
  await page.getByRole('button', { name: 'Create prescription', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Complete visit', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Complete visit', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls.some(q => q.includes('myWorkspace') || q.includes('workspaceAction') || q.includes('createLoginQr'))).toBe(false);
  await page.goto('/appointments');
  await expect(page.getByRole('heading', { name: 'Appointment booking requires a backend API' })).toBeVisible();
});
test('live pharmacy uses price list and wallet without fake inventory stock', async ({ page }) => {
  const { requests } = await fixture(page, 'PHARMACY'); await liveSignIn(page); await expect(page).toHaveURL(/pharmacy/);
  await expect(page.getByRole('heading', { name: 'Medicine price list', exact: true })).toBeVisible();
  await expect(page.locator('.simulation-price')).toContainText('Test medicine');
  await expect(page.getByRole('button', { name: 'Set medicine price', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add medicine', exact: true })).toHaveCount(0);
  await page.getByLabel('Patient QR URL or token').fill('patient-live-token');
  await page.getByRole('button', { name: 'Verify patient QR', exact: true }).click();
  await page.getByRole('button', { name: 'Serve prescription', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm served', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Serve prescription', exact: true })).toHaveCount(0);
  expect(requests.find(r => r.query.includes('mutation Dispense'))?.variables).toEqual({ itemId: 'live-item' });
  await expect(page.getByText('Stock quantities, expiry dates and inventory movement reports requires a backend API', { exact: true })).toBeVisible();
});
test('live connection errors do not fall back to simulation and modes do not share sessions', async ({ page }) => {
  let simulationCalls = 0;
  await page.route('**:4000/graphql', async route => { simulationCalls++; await route.abort(); });
  await page.route('**/api/backend/**', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Live backend offline', extensions: { code: 'CONNECTION_FAILED' } }] }) }));
  await page.goto('/login'); await page.getByLabel('Email, phone or username').fill('someone');
  await page.getByRole('button', { name: 'Request code', exact: true }).click();
  await expect(page.locator('.error-message')).toContainText('Live backend offline');
  expect(simulationCalls).toBe(0);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('emerald-auth')))).toEqual([]);
});
test('later read auth failures never repeat a successful clinical mutation', async () => {
  const original = globalThis.fetch;
  let diagnoses = 0, refreshes = 0, reads = 0;
  const u = person(); const p = patient(); const s = { id: 's-live', status: 'ACTIVE', patient: p, doctor: { id: 'd', user: u }, hospital: {}, startedAt: '2026-10-31T10:00:00Z', vitals: null, diagnosis: null, prescription: null };
  globalThis.fetch = async (_url, init) => {
    const { query } = JSON.parse(String(init?.body)); let data: any;
    if (query.includes('query ActiveSession')) data = { myActiveSession: s };
    else if (query.includes('mutation Diagnosis')) { diagnoses++; data = { recordDiagnosis: { id: 'dx' } }; }
    else if (query.includes('query Session')) { reads++; if (reads === 1) return Response.json({ errors: [{ message: 'Expired', extensions: { code: 'UNAUTHENTICATED' } }] }); data = { session: s }; }
    else if (query.includes('mutation RefreshToken')) { refreshes++; data = { refreshToken: { accessToken: 'new-access', refreshToken: 'new-refresh', user: u } }; }
    else throw Error(query);
    return Response.json({ data });
  };
  try {
    const client = new SimulationClient('/api/backend/', 'live'); client.setAuth({ accessToken: 'old-access', refreshToken: 'refresh', user: { id: u.id, name: u.name, role: 'DOCTOR', profileComplete: true, identifier: 'live@example.test' } });
    await client.request(operations.workspace);
    await client.request(operations.workspaceAction, { kind: 'ADD_DIAGNOSIS', input: { patientId: p.publicId, name: 'Test', notes: 'Test notes' } });
    expect(diagnoses).toBe(1); expect(refreshes).toBe(1); expect(reads).toBe(2);
  } finally { globalThis.fetch = original; }
});

test('switching from simulation to live never sends simulation credentials to the proxy', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await expect(page).toHaveURL(/login/);
  await page.getByRole('button', { name: 'Live backend', exact: true }).click();
  let authorization: string | undefined;
  await page.route('**/api/backend/**', async route => {
    authorization = route.request().headers()['authorization'];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { requestOtp: true } }) });
  });
  await page.getByLabel('Email, phone or username').fill('live-user');
  await page.getByRole('button', { name: 'Request code', exact: true }).click();
  await expect(page.getByLabel('One-time code')).toBeVisible();
  expect(authorization).toBeUndefined();
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('emerald-auth-v3:')))).toEqual([]);
});

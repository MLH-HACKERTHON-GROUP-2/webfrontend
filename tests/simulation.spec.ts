import { test, expect } from '@playwright/test';
import { login } from './helpers';
test('hospital and pharmacy onboarding is available inside the actual system', async ({ page, context }) => {
  await login(page, 'system@emerald.care');
  await expect(page).toHaveURL(/administration/);
  const suffix = Date.now(), adminId = `hospital.${suffix}@test.example`, docId = `doctor.${suffix}@test.example`, pharmacyId = `pharmacy.${suffix}@test.example`;
  const hospital = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Add a hospital', exact: true }) });
  await hospital.getByLabel('Hospital name', { exact: true }).fill('New Connected Hospital');
  await hospital.getByLabel('Hospital address').fill('Cape Town');
  await hospital.getByLabel('Consultation fee (ZAR)').fill('200');
  await hospital.getByLabel('Administrator name').fill('New Administrator');
  await hospital.getByLabel('Administrator identifier').fill(adminId);
  await hospital.getByRole('button', { name: 'Create hospital', exact: true }).click();
  await expect(page.locator('.simulation-price').filter({ hasText: 'New Connected Hospital' })).toBeVisible();
  const pharmacy = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Add a pharmacy', exact: true }) });
  await pharmacy.getByLabel('Pharmacy name', { exact: true }).fill('New Connected Pharmacy');
  await pharmacy.getByLabel('Pharmacy address').fill('Cape Town');
  await pharmacy.getByLabel('Pharmacist name').fill('New Pharmacist');
  await pharmacy.getByLabel('Pharmacist identifier').fill(pharmacyId);
  await pharmacy.getByRole('button', { name: 'Create pharmacy', exact: true }).click();
  await expect(page.locator('.simulation-price').filter({ hasText: 'New Connected Pharmacy' })).toBeVisible();
  const administrator = await context.newPage();
  await login(administrator, adminId);
  await administrator.getByLabel('Doctor name').fill('New Connected Doctor');
  await administrator.getByLabel('Doctor identifier').fill(docId);
  await administrator.getByRole('button', { name: 'Add doctor', exact: true }).click();
  await expect(administrator.locator('.simulation-price').filter({ hasText: docId })).toBeVisible();
  const doctor = await context.newPage();
  await login(doctor, docId);
  await expect(doctor).toHaveURL(/dashboard/);
  await expect(doctor.locator('.sidebar-user')).toContainText('New Connected Doctor');
  await doctor.goto('/session');
  await expect(doctor.getByRole('button', { name: 'Generate login QR', exact: true })).toBeVisible();
  const pharmacist = await context.newPage();
  await login(pharmacist, pharmacyId);
  await expect(pharmacist).toHaveURL(/pharmacy/);
  await expect(pharmacist.locator('.medicine-card')).toHaveCount(0);
  await expect(pharmacist.getByRole('button', { name: 'Add medicine', exact: true })).toBeVisible();
  await administrator.close(); await doctor.close(); await pharmacist.close();
});
test('client refreshes once after auth rejection and never retries a failed payment transport', async ({ page }) => {
  await login(page, 'patient@emerald.care');
  let refreshes = 0, qrRequests = 0, topUps = 0;
  await page.route('**/graphql', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const query = route.request().postDataJSON().query as string;
    if (query.includes('mutation RefreshToken')) refreshes++;
    if (query.includes('mutation GenerateQr')) {
      qrRequests++;
      if (qrRequests === 1) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Expired', extensions: { code: 'UNAUTHENTICATED' } }] }) });
    }
    if (query.includes('mutation TopUp')) { topUps++; return route.abort('failed'); }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Generate patient QR', exact: true }).click();
  await expect(page.getByLabel('Scan URL', { exact: true })).toBeVisible();
  expect(refreshes).toBe(1); expect(qrRequests).toBe(2);
  await page.getByRole('button', { name: 'Add simulated funds', exact: true }).click();
  await expect(page.locator('.simulation-error')).toContainText('Cannot reach');
  expect(topUps).toBe(1);
});
test('new patient profile and wallet use the normal portal', async ({ page }) => {
  await login(page, 'new.patient@emerald.care');
  await expect(page).toHaveURL(/portal/);
  await page.getByLabel('Full name', { exact: true }).fill('New Connected Patient');
  await page.getByLabel('Age', { exact: true }).fill('25');
  await page.getByLabel('Gender', { exact: true }).fill('Other');
  await page.getByLabel('Blood group', { exact: true }).fill('O+');
  await page.getByLabel('Allergies', { exact: true }).fill('None known');
  await page.getByRole('button', { name: 'Complete profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate patient QR', exact: true })).toBeVisible();
  await page.getByLabel('Top-up amount (ZAR)').fill('500');
  await page.getByRole('button', { name: 'Add simulated funds', exact: true }).click();
  await expect(page.locator('.stat-card').filter({ hasText: 'Patient wallet' })).toContainText('500');
  await page.reload();
  await expect(page.locator('.stat-card').filter({ hasText: 'Patient wallet' })).toContainText('500');
});
test('patient QR is easy to find at the top of My care and explains the scan flow', async ({ page }) => {
  await login(page, 'patient@emerald.care');
  await expect(page.getByRole('link', { name: 'My patient QR' })).toBeVisible();
  await page.getByRole('link', { name: 'My patient QR' }).click();
  await expect(page).toHaveURL(/#patient-qr$/);
  await expect(page.getByRole('heading', { name: 'Your patient QR' })).toBeVisible();
  await expect(page.getByText(/Show this short-lived code to your doctor or pharmacist/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate patient QR', exact: true })).toBeVisible();
});
test('pharmacists cannot open doctor routes and old simulation URL redirects to actual pages', async ({ page }) => {
  await login(page, 'pharmacy@emerald.care');
  await page.goto('/session');
  await expect(page).toHaveURL(/pharmacy/);
  await page.goto('/simulation');
  await expect(page).toHaveURL(/pharmacy/);
  await expect(page.locator('.sidebar')).toBeVisible();
});

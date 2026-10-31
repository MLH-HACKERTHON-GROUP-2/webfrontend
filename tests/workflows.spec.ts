import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
const {
  PNG
} = createRequire(process.cwd() + '/package.json')('pngjs');
async function enter(page: Page, path = '/dashboard') {
  await page.addInitScript(() => sessionStorage.setItem('emerald-session', 'demo'));
  await page.goto(path);
  await expect(page.locator('.sidebar')).toBeVisible();
}
test('login, rejected credentials, password reset and sign out', async ({
  page
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Password', {
    exact: true
  }).fill('wrong-pass');
  await page.getByRole('button', {
    name: 'Sign in',
    exact: true
  }).click();
  await expect(page.locator('.error-message')).toContainText('Use the demo account');
  await page.getByRole('link', {
    name: 'Forgot password?'
  }).click();
  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();
  await page.getByLabel('New password', {
    exact: true
  }).fill('NewEmerald2026!');
  await page.getByLabel('Confirm new password').fill('NewEmerald2026!');
  await page.getByRole('button', {
    name: 'Reset demo password'
  }).click();
  await expect(page.getByRole('heading', {
    name: 'You’re all set.'
  })).toBeVisible();
  await page.getByRole('link', {
    name: 'Back to sign in'
  }).click();
  await page.getByLabel('Password', {
    exact: true
  }).fill('NewEmerald2026!');
  await page.getByRole('button', {
    name: 'Sign in',
    exact: true
  }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole('button', {
    name: 'Sign out',
    exact: true
  }).click();
  await expect(page).toHaveURL(/login/);
});
test('book a visit, reject a conflict, persist and cancel', async ({
  page
}) => {
  await enter(page, '/appointments');
  await page.getByRole('button', {
    name: 'New appointment',
    exact: true
  }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('combobox', {
    name: 'Patient',
    exact: true
  }).selectOption('PT-1008');
  await modal.getByLabel('Time', {
    exact: true
  }).fill('09:00');
  await modal.getByLabel('Reason for visit').fill('Appointment test');
  await modal.getByRole('button', {
    name: 'Book appointment'
  }).click();
  await expect(modal.getByRole('alert')).toContainText('already booked');
  await modal.getByLabel('Time', {exact: true}).fill('09:15');
  await modal.getByRole('button', {name: 'Book appointment'}).click();
  await expect(modal.locator('.error-message')).toContainText('overlaps');
  await modal.getByLabel('Time', {
    exact: true
  }).fill('15:00');
  await modal.getByRole('button', {
    name: 'Book appointment'
  }).click();
  await expect(page.getByRole('status')).toContainText('booked');
  await page.reload();
  const row = page.getByRole('row').filter({
    hasText: 'Appointment test'
  });
  await expect(row).toBeVisible();
  await row.getByRole('button', {
    name: 'View details'
  }).click();
  await page.getByRole('dialog').getByRole('button', {
    name: 'Cancel appointment',
    exact: true
  }).click();
  await expect(row).toContainText('Cancelled');
});
test('consultation connects to records, QR lookup, dispensing, stock and reports', async ({
  page
}) => {
  await enter(page, '/session?patient=PT-1001&appointment=APT-201');
  await page.getByRole('button', {
    name: 'Add diagnosis',
    exact: true
  }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Diagnosis', {
    exact: true
  }).fill('Workflow test diagnosis');
  await dialog.getByLabel('ICD-10 code (optional)').fill('Z00.0');
  await dialog.getByLabel('Clinical assessment').fill('Synthetic assessment for workflow verification');
  await dialog.getByRole('button', {
    name: 'Save diagnosis'
  }).click();
  await expect(page.getByRole('heading', {
    name: /Workflow test diagnosis/
  })).toBeVisible();
  await page.getByRole('button', {
    name: 'New prescription',
    exact: true
  }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', {
    name: 'Medicine',
    exact: true
  }).selectOption('MED-003');
  await dialog.getByLabel('Dosage / frequency').fill('Demo clinician instructions');
  await dialog.getByLabel('Quantity', {
    exact: true
  }).fill('10');
  await dialog.getByLabel('Duration', {
    exact: true
  }).fill('Test duration');
  await dialog.getByLabel('Additional instructions').fill('Synthetic workflow test only');
  await dialog.getByRole('button', {
    name: 'Create prescription'
  }).click();
  await expect(page.getByRole('status')).toContainText('pharmacy queue');
  await page.getByLabel('Clinical notes', {
    exact: true
  }).fill('Workflow test clinical note');
  await page.getByRole('button', {
    name: 'Complete visit',
    exact: true
  }).click();
  await page.getByRole('dialog').getByRole('button', {
    name: 'Complete visit',
    exact: true
  }).click();
  await expect(page.getByRole('button', {
    name: 'Visit closed'
  })).toBeDisabled();
  await page.locator('.patient-banner').getByRole('link', {
    name: 'Medical records',
    exact: true
  }).click();
  await expect(page.getByRole('heading', {
    name: /Workflow test diagnosis/
  })).toBeVisible();
  await page.getByRole('button', {
    name: 'Patient QR code'
  }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.getByRole('link', {
    name: 'Download QR'
  })).toHaveAttribute('download', 'PT-1001-qr.png');
  const qrSource = await page.getByRole('dialog').getByRole('img').getAttribute('src');
  const image = PNG.sync.read(Buffer.from(qrSource!.split(',')[1], 'base64'));
  expect(jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data).toBe('PT-1001');
  await page.getByRole('button', {
    name: 'Close dialog'
  }).click();
  await page.goto('/pharmacy');
  await page.getByRole('button', {
    name: 'Scan patient QR',
    exact: true
  }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Patient ID', {
    exact: true
  }).fill('PT-invalid');
  await dialog.getByRole('button', {
    name: 'Look up patient'
  }).click();
  await expect(dialog.getByRole('alert')).toContainText('Patient not found');
  await dialog.getByLabel('Patient ID', {
    exact: true
  }).fill('PT-1001');
  await dialog.getByRole('button', {
    name: 'Look up patient'
  }).click();
  await expect(page.getByRole('dialog').getByRole('heading', {
    name: 'Olivia Rhye'
  })).toBeVisible();
  const rx = page.locator('.dispense-prescription').filter({
    hasText: 'Paracetamol'
  });
  await rx.getByRole('button', {
    name: 'Serve prescription'
  }).click();
  await page.getByRole('button', {
    name: 'Confirm served'
  }).click();
  await expect(page.getByRole('status')).toContainText('Stock and reports updated');
  await expect(page.locator('.dispense-prescription').filter({
    hasText: 'Paracetamol'
  })).toHaveCount(0);
  await page.getByRole('button', {
    name: 'Close patient'
  }).click();
  expect(await page.locator('body').evaluate(el => el.style.overflow)).not.toBe('hidden');
  const medicine = page.locator('.medicine-card').filter({
    hasText: 'Paracetamol'
  });
  await expect(medicine.locator('.medicine-stock')).toContainText('510');
  await page.reload();
  await expect(medicine.locator('.medicine-stock')).toContainText('510');
  await page.goto('/reports');
  await page.getByLabel('Movement type').selectOption('Dispensed');
  const movement = page.getByRole('row').filter({
    hasText: 'Paracetamol'
  });
  await expect(movement).toContainText('−10');
  await page.getByRole('button', {
    name: 'Patient analysis',
    exact: true
  }).click();
  await page.getByLabel('Filter patients by case').selectOption('Hypertension');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', {
    name: 'Export report'
  }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe('emerald-patient-analysis.csv');
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv).toContain('Olivia Rhye');
  expect(csv).toContain('Drew Cano');
  expect(csv).not.toContain('Phoenix Baker');
});
test('add medicine and receive stock creates report entries', async ({
  page
}) => {
  await enter(page, '/pharmacy');
  await page.getByRole('button', {
    name: 'Add medicine',
    exact: true
  }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Medicine name', {
    exact: true
  }).fill('Test medicine');
  await dialog.getByLabel('Generic name').fill('Test generic');
  await dialog.getByLabel('Strength', {
    exact: true
  }).fill('10 mg');
  await dialog.getByLabel('Opening stock (units)').fill('20');
  await dialog.getByLabel('Price per unit (ZAR)').fill('4.50');
  await dialog.getByLabel('Expiry date').fill('2028-12-31');
  await dialog.getByRole('button', {
    name: 'Add medicine',
    exact: true
  }).click();
  const card = page.locator('.medicine-card').filter({
    hasText: 'Test medicine'
  });
  await expect(card).toContainText('20');
  await card.getByRole('button', {
    name: 'Receive stock'
  }).click();
  await page.getByLabel('Quantity received (units)').fill('25');
  await page.getByRole('dialog').getByRole('button', {
    name: 'Receive stock',
    exact: true
  }).click();
  await expect(card.locator('.medicine-stock')).toContainText('45');
  await page.goto('/reports');
  await expect(page.getByRole('row').filter({
    hasText: 'Test medicine'
  })).toHaveCount(2);
});
test('profile edits persist and report filters handle empty results', async ({
  page
}) => {
  await enter(page, '/profile');
  await page.getByLabel('Full name').fill('Dr. Alex Morgan');
  await page.getByRole('button', {
    name: 'Sat',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Save changes'
  }).click();
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Dr. Alex Morgan');
  await expect(page.getByRole('button', {
    name: 'Sat',
    exact: true
  })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/reports');
  await page.getByLabel('Report start date').fill('2026-10-31');
  await page.getByRole('button', {
    name: 'Appointments',
    exact: true
  }).click();
  await page.getByLabel('Report appointment status').selectOption('Completed');
  await expect(page.getByText('No appointments in this period')).toBeVisible();
});
test('all routes render without browser errors and fit mobile', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await enter(page);
  for (const route of ['/dashboard', '/appointments', '/session', '/records', '/profile', '/pharmacy', '/reports']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
  }
  await page.getByRole('button', {
    name: 'Open navigation'
  }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.locator('.sidebar').getByRole('link', {
    name: 'Overview',
    exact: true
  }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: 'test-results/dashboard-mobile.png',
    fullPage: true
  });
});
test('desktop dashboard visual', async ({
  page
}) => {
  await page.setViewportSize({
    width: 1440,
    height: 1100
  });
  await enter(page);
  await expect(page.locator('.nav-item.active')).toContainText('Overview');
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true
  });
  await page.goto('/login');
  await page.screenshot({
    path: 'test-results/login-desktop.png',
    fullPage: true
  });
});
test('camera scanner decodes a QR video frame and stops its stream', async ({
  page
}) => {
  const QRCode = createRequire(process.cwd() + '/package.json')('qrcode');
  const src = await QRCode.toDataURL('PT-1002', {
    width: 260,
    margin: 4
  });
  await page.addInitScript(({
    src
  }) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d')!;
          const image = new Image();
          image.src = src;
          await image.decode();
          const draw = () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 640, 480);
            ctx.drawImage(image, 190, 110, 260, 260);
          };
          draw();
          const media = canvas.captureStream(10);
          (window as any).__qrTestStream = media;
          const timer = setInterval(draw, 100);
          media.getTracks()[0].addEventListener('ended', () => clearInterval(timer));
          return media;
        }
      }
    });
  }, {
    src
  });
  await enter(page, '/pharmacy');
  await page.getByRole('button', {
    name: 'Scan patient QR',
    exact: true
  }).first().click();
  await page.getByRole('button', {
    name: 'Enable camera'
  }).click();
  await expect(page.getByRole('dialog').getByRole('heading', {
    name: 'Phoenix Baker'
  })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__qrTestStream.getTracks().every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
});

import { expect, type Page } from '@playwright/test';
export async function login(page: Page, identifier = 'doctor@emerald.care') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill(identifier);
  await page.getByRole('button', { name: 'Request code', exact: true }).click();
  await page.getByLabel('One-time code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
}
export async function createPair(page: Page) {
  await page.getByRole('button', { name: /^Generate (new )?login QR$/ }).click();
  await expect(page.getByRole('img', { name: 'One-time login QR for patient pairing' })).toBeVisible();
  return page.getByLabel('One-time pairing link').inputValue();
}
export async function approve(page: Page, link: string) {
  await page.getByLabel('Staff login QR or pairing link').fill(link);
  await page.getByRole('button', { name: 'Review connection', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Approve patient connection' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve connection', exact: true }).click();
}
export async function chooseDate(page: Page, label: string, value: string) {
  const [year, month, day] = value.split('-').map(Number), date = new Date(year, month - 1, day, 12);
  await page.getByRole('button', { name: label, exact: true }).click();
  const popup = page.getByRole('dialog', { name: `${label} calendar`, exact: true });
  await expect(popup).toBeVisible();
  await popup.getByRole('combobox', { name: 'Calendar year' }).click();
  await page.getByRole('option', { name: String(year), exact: true }).click();
  await popup.getByRole('combobox', { name: 'Calendar month' }).click();
  await page.getByRole('option', { name: date.toLocaleDateString('en-ZA', { month: 'long' }), exact: true }).click();
  const name = date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  await popup.getByRole('button', { name: new RegExp(`^${name}(, selected)?$`) }).click();
  await expect(popup).toHaveCount(0);
}

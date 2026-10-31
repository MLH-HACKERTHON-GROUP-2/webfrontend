# Emerald Care

A responsive hospital management interface built with **Next.js App Router, React and TypeScript**, inspired by the five reference images in the parent folder. Emerald green replaces the references’ blue accents; the sidebar, clinical cards, appointment calendar, patient detail layout and split authentication screen carry their visual structure forward.

## Run locally

```bash
cd emerald-care
npm install
npm run dev
```

Open <http://localhost:3000>. Node 22 is installed as a local development dependency so the scripts also work when the host Node version is older. A network connection is required for the initial dependency install.

```bash
npm run typecheck
npm run build
```

The production build creates `out/`, a static export that can be served by a static web host. `next start` is for server builds; with the supplied static export config, preview `out/` using a static server instead. Fonts use Google Fonts with system fallbacks.

## Demo sign in

- Email: `doctor@emerald.care`
- Password: `Emerald2026!`
- Alternatively, select **Try the interactive demo**.

Password reset updates the demo password only in this browser. No email is sent. Sign out clears the tab’s demo session. This is a frontend prototype: the route gate and demo credentials are not production authentication or authorization.

## Pages

| Route | Features |
| --- | --- |
| `/login` | Demo credentials, password visibility, interactive demo entry |
| `/password-reset` | Demo email validation, password confirmation and local reset |
| `/dashboard` | Computed summary metrics, activity chart, interactive calendar, upcoming visits and quick links |
| `/appointments` | Search, date/status filters, list/calendar views, booking, 30-minute overlap detection, cancellation and CSV export |
| `/session?patient=PT-1001&appointment=APT-201` | Patient information, sample vitals, clinical notes, diagnosis and prescription dialogs, start/complete visit |
| `/records?patient=PT-1001` | Searchable directory, overview, diagnoses, prescriptions, visit history, clinical notes, patient QR generation/download and CSV export |
| `/profile` | Editable clinician information and weekly availability |
| `/pharmacy` | Medicine catalog, category/stock filters, new medicine dialog, stock receipts, prescription queue, QR camera scanner and patient ID fallback |
| `/reports` | Medicine movement, patient analysis by case, age distribution and appointment reports with date filters and CSV exports |

## Try the connected workflow

1. Start Olivia Rhye’s consultation from the dashboard.
2. Add a diagnosis, write and save a note, and create a prescription.
3. Complete the visit. The appointment and clinical record update together.
4. Open the medical record and generate/download Olivia’s QR code.
5. In Pharmacy, choose **Scan patient QR**. Scan the generated code, or enter `PT-1001`.
6. Review allergies, medical information and pending prescriptions.
7. Serve a prescription and confirm. Stock decreases, the prescription leaves the pending queue, and the dispense is added to medicine movement reports.
8. Receive stock or add a medicine to see stock-receipt entries in reports.

The QR contains only the patient ID. Camera scanning requires HTTPS or localhost and camera permission. Camera streams stop when the scanner closes. Filters and CSV exports use the current browser dataset.

## Data and limitations

All records are synthetic. All demo activity is dated **31 October 2026 (SAST)** for consistency with the provided task date; appointment dates and report periods are editable. Clinical vitals are explicitly labelled sample values. Prescription dosages are entered by the user; the app does not generate treatment recommendations.

State is saved under `emerald-care-v1` in localStorage. A session is stored in sessionStorage. Data is not shared across users, tabs or devices, and clearing browser storage restores the seed dataset. The profile’s availability is an editable preference; demo appointment slots use fixed practice hours and conflict checks. Stock uses a single catalog expiry date, rather than per-batch tracking.

Before using actual patient data, add server authentication and role-based access, durable database storage, password-reset email delivery, server validation and transactions, audit history, per-batch inventory and the required operational controls. The current local demo contains none of those backend services.

## Browser verification

```bash
npm run build
npm run test:e2e
```

The test runner starts a local static server for `out/` automatically (Python 3 is required), or reuses a server already running on port 3000.

Playwright uses an existing Chromium installation when `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is set; otherwise install its supported browser using `npx playwright install chromium`. Tests cover sign-in/reset, booking conflicts, clinical record updates, QR ID lookup, dispensing/stock/report synchronization, stock receipts, profile persistence, filtered exports and mobile layouts.

Reference architecture: [Next.js App Router static exports](https://nextjs.org/docs/app/guides/static-exports).

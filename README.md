# Emerald Care

A Next.js App Router clinical workspace with emerald styling and two explicitly separate backend modes. **Live backend is the default**, connected to `https://unstarched-maritally-ike.ngrok-free.dev/graphql`. Select **Simulation** on the sign-in page to use the full local mock system.

## Run

Use Node.js 22 on the operating system where you run the app:

```bash
cd emerald-care
npm install
npm run dev
```

Open <http://localhost:3000/login>. In live mode, enter your registered email, phone number or username and use the one-time code supported by the backend. Roles come from the backend, never from the identifier text or a frontend role selector. The service exposes OTP authentication; it does not expose password authentication. The simulation's demo identifiers are not live doctor/admin credentials.

To use simulation, also run this in another terminal and select **Simulation** at login:

```bash
npm run mock:backend
```

Simulation accounts: `doctor@emerald.care`, `pharmacy@emerald.care`, `patient@emerald.care`, `avery.patient@emerald.care`, `new.patient@emerald.care`, `hospital@emerald.care`, `system@emerald.care`. Simulation OTP: **000000**. The quick demo button appears only in simulation.

## What each mode supports

| Feature | Live backend | Simulation |
| --- | --- | --- |
| OTP sign-in, role routing, session refresh | Connected | Available |
| Patient profile, records, wallet, transaction history | Connected | Available |
| Patient-generated QR lookup | Connected | Available |
| Doctor consultation, vitals, diagnosis, prescriptions, finalization | Connected to live schema | Available |
| Pharmacy price list and dispensing | Connected to live schema | Available |
| Hospital/pharmacy/doctor onboarding | Connected; needs the appropriate live admin account | Available |
| One-time staff QR and patient approval | Missing pairing operations on backend | Available |
| Appointments, stock quantities/expiry/receipts, reports, doctor profile editing | Missing operations on backend | Available |
| Updates | Refresh/polling; no subscriptions exposed | WebSocket events and fallback refresh |

Unsupported live features show an explanation instead of fabricated records or mock writes. Live requests never automatically fall back to simulation. Mode-specific sessions and pending QR challenges are kept separate. Sign out before switching modes.

Patients using **Simulation** can book from the **My appointments** card on `/portal` or the **My appointments** sidebar link. They choose a hospital, doctor, date, time and reason. Their booking appears in that doctor's schedule, and patients can cancel their own upcoming appointments. The live backend currently has no appointment operations, so patient booking is unavailable in Live mode until scheduling is added to its API.

## Configuration and deployment

Defaults work without an environment file. See [.env.example](.env.example):

```dotenv
NEXT_PUBLIC_BACKEND_MODE=live
LIVE_GRAPHQL_URL=https://unstarched-maritally-ike.ngrok-free.dev/graphql
NEXT_PUBLIC_SIMULATION_GRAPHQL_URL=http://localhost:4000/graphql
```

`LIVE_GRAPHQL_URL` is server-only. The browser uses `/api/backend/`; the Next.js route forwards to the configured upstream with the ngrok warning-bypass header. This avoids the live endpoint's failing browser preflight and never accepts an upstream URL from a caller. Requests are uncached and financial transport failures are not automatically retried.

**Next.js must run as a server now.** `npm run build` creates the Next.js production build; `npm start` runs it. The former static `out/` export cannot provide the live proxy. Restart Next.js after changing environment settings. Windows and WSL dependencies must match the operating system where npm runs.

## Simulation workflow

1. Sign in as doctor and open Olivia's consultation. Click **Start visit**.
2. Record vitals, add a diagnosis, save notes and create a prescription.
3. **Complete visit** charges the consultation once and releases prescription items.
4. Pharmacist signs into a separate tab and generates a one-time login QR. Patient signs into their portal, scans/pastes the staff code, reviews the provider and approves.
5. Pharmacist reviews the connected patient and confirms dispensing. Wallets, stock, prescription status and reports update together.
6. Either person can disconnect. Pharmacy patient access clears. Staff QR challenges last two minutes and work once; approved links last 30 minutes.

Live mode uses the backend's supported reverse direction: the **patient generates the QR**, then the doctor/pharmacist scans it in Patient connections or Pharmacy. A live doctor enters medicine names directly because the live API does not provide a doctor medicine catalog. Live vitals map heart rate to `pulse` and weight to `weightKg`; oxygen saturation is not exposed. Clinical notes use the backend's vitals notes field. Patient profiles use date of birth and sex; blood group is not exposed.

## Checks

```bash
npm run check:live
npm run typecheck
npm run test:backend
npm run build
npm run test:e2e
```

`check:live` performs read-only health and schema validation against the current live service. Browser tests exercise simulation plus live-adapter fixtures validated against [backend/schema.live.graphql](backend/schema.live.graphql). No live financial mutations are made by these tests. Live staff account verification requires actual staff identifiers assigned by that service.

Simulation data lives in the mock server's memory and resets on restart. Live data follows the remote backend's persistence rules. Tokens are retained in each tab's sessionStorage for reloads; production session security should be agreed with the backend owner. See [INTEGRATION.md](INTEGRATION.md) for the contract, transport, limitations and backend handoff.
# webfrontend

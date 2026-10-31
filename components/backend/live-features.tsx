'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QrCode, Wallet, Pill, Plus, RefreshCw, Stethoscope, ScanLine } from 'lucide-react';
import { useStore } from '@/lib/store';
import { operations } from '@/lib/backend/operations';
import { money } from '@/lib/data';
import { ScanPatient } from '@/components/qr';
import { PageHeading, Panel, Empty, Stat, FormField, Modal } from '@/components/ui';
export function UnavailableLive({
  feature
}: {
  feature: string;
}) {
  return <Panel title={`${feature} requires a backend API`}><div className="panel-body"><p>The connected live service does not expose {feature.toLowerCase()} operations yet. This feature remains available in Simulation mode.</p><p className="small-muted">Live records and simulated records are kept separate.</p><Link href="/dashboard" className="text-link">Return to your workspace</Link></div></Panel>;
}
export function LiveDashboard() {
  const {
    state,
    reload,
    run,
    busy
  } = useStore();
  const active = state.sessions?.filter(s => s.status === 'ACTIVE') || [];
  return <><PageHeading title={`Welcome, ${state.profile.name}.`} description="Your live clinical workspace. Scan a patient QR to begin care." actions={<Link className="button primary" href="/connections"><QrCode size={16} />Scan patient QR</Link>} /><div className="stats-grid"><Stat label="Active consultations" value={active.length} detail="Returned by the live service" icon={<Stethoscope size={20} />} accent /><Stat label="Opened patient records" value={state.patients.length} detail="Authorized records opened in this tab" icon={<QrCode size={20} />} /><Stat label="Prescription items" value={state.prescriptions.length} detail="In the loaded clinical records" icon={<Pill size={20} />} /></div><Panel title="Your consultations"><div className="panel-body">{active.map(s => <div key={s.id} className="simulation-price"><span>{state.patients.find(p => p.id === s.patientId)?.name || s.patientId}</span><Link className="button primary" href={`/session?patient=${encodeURIComponent(s.patientId)}`}>Continue consultation</Link></div>)}{!active.length && <Empty title="Ready for your next patient" text="Open Patient connections and scan the patient’s short-lived QR." />}<button className="button" disabled={busy} onClick={() => run(reload)}><RefreshCw size={15} />Refresh</button></div></Panel><div className="simulation-callout"><p>Scheduling and aggregate dashboard reports are not provided by this live API. Clinical information above comes from the service; no simulation records are loaded.</p></div></>;
}
export function LivePatientScan() {
  const {
    state,
    run,
    busy,
    verifyPatient,
    user
  } = useStore();
  const [value, setValue] = useState(''),
    [camera, setCamera] = useState(false),
    [patientId, setPatientId] = useState('');
  const scan = (raw: string) => run(async () => {
    setPatientId(await verifyPatient(raw));
  });
  const patient = state.patients.find(p => p.id === patientId) || state.patients[0];
  return <><Panel title="Scan the patient's QR" subtitle="The patient generates this short-lived code from their portal."><form className="panel-body simulation-scan" onSubmit={e => {
        e.preventDefault();
        void scan(value);
      }}><FormField label="Patient QR URL or token"><input value={value} onChange={e => setValue(e.target.value)} required autoComplete="off" /></FormField><button className="button" type="button" disabled={busy} onClick={() => setCamera(true)}><ScanLine size={16} />Scan camera</button><button className="button primary" disabled={busy}>Verify patient QR</button></form>{patient && <div className="simulation-patient"><strong>{patient.name}</strong><span>{patient.id} · Allergies: {patient.allergies}</span><Link className="button primary" href={user?.role === 'DOCTOR' ? `/session?patient=${encodeURIComponent(patient.id)}` : '/pharmacy'}>{user?.role === 'DOCTOR' ? 'Open consultation' : 'Open prescriptions'}</Link></div>}</Panel><div className="simulation-callout"><p>Patient-generated QR scanning is supported live. One-time staff QR generation and patient approval require pairing operations that this backend does not currently expose.</p></div>{camera && <ScanPatient onClose={() => setCamera(false)} onScan={raw => {
      setCamera(false);
      setValue(raw);
      void scan(raw);
    }} />}</>;
}
export function LivePharmacy() {
  const {
    state,
    client,
    run,
    busy,
    reload
  } = useStore();
  const [price, setPrice] = useState(false),
    [serving, setServing] = useState<string | null>(null);
  const pending = state.prescriptions.filter(r => r.status === 'Pending');
  const current = state.prescriptions.find(r => r.id === serving);
  return <><PageHeading title="Pharmacy" description="Live medicine pricing, patient lookup and prescription dispensing." actions={<button className="button primary" onClick={() => setPrice(true)}><Plus size={16} />Set medicine price</button>} /><div className="stats-grid"><Stat label="Pharmacy wallet" value={money(state.wallet || 0)} detail="Current live balance" icon={<Wallet size={20} />} accent /><Stat label="Priced medicines" value={state.medicines.length} detail="Medicines in the live price list" icon={<Pill size={20} />} /><Stat label="Pending prescriptions" value={pending.length} detail="From the scanned patient" icon={<Pill size={20} />} /></div><LivePatientScan />{state.liveNotice && <div className="simulation-callout"><p>{state.liveNotice}</p></div>}<Panel title="Pending prescriptions"><div className="panel-body">{pending.map(r => <div className="simulation-rx" key={r.id}><div><h3>{state.medicines.find(m => m.id === r.medicineId)?.name}</h3><p>{r.dosage} · {r.quantity} units</p><p>{r.instructions}</p></div><button className="button primary" disabled={busy} onClick={() => setServing(r.id)}>Serve prescription</button></div>)}{!pending.length && <Empty title="No pending prescriptions loaded" text="Scan the patient's current QR to retrieve their prescriptions." />}</div></Panel><Panel title="Medicine price list"><div className="panel-body">{state.medicines.map(m => <div className="simulation-price" key={m.id}><strong>{m.name}</strong><span>{money(m.price)} / unit</span></div>)}</div></Panel><UnavailableLive feature="Stock quantities, expiry dates and inventory movement reports" />
    {price && <Modal title="Set medicine price" onClose={() => setPrice(false)}><form onSubmit={e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void run(async () => {
          await client.request(operations.price, {
            input: {
              drugName: f.get('drugName'),
              price: Number(f.get('price'))
            }
          });
          await reload();
          setPrice(false);
        });
      }}><div className="form-grid"><FormField label="Medicine name"><input name="drugName" required /></FormField><FormField label="Price per unit (ZAR)"><input name="price" type="number" min="0" step="0.01" required /></FormField></div><div className="modal-actions"><button className="button primary" disabled={busy}>Save medicine price</button></div></form></Modal>}
    {current && <Modal title="Confirm medicine served" description="This action records dispensing and charges the live patient wallet according to the backend's pricing rules." onClose={() => setServing(null)}><div className="panel-body"><p>{state.medicines.find(m => m.id === current.medicineId)?.name} · {current.quantity} units</p></div><div className="modal-actions"><button className="button" onClick={() => setServing(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => run(async () => {
          await client.request(operations.dispense, {
            itemId: current.id
          });
          await reload();
          setServing(null);
        })}>Confirm served</button></div></Modal>}
  </>;
}

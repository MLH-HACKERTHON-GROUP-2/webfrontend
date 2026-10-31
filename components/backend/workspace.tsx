'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, QrCode, Pill, ArrowRight, Stethoscope } from 'lucide-react';
import { useStore } from '@/lib/store';
import { operations } from '@/lib/backend/operations';
import type { BackendUser, Patient, Hospital, Pharmacy, Qr, Session } from '@/lib/backend/types';
import { money } from '@/lib/data';
import { Panel, Stat, PageHeading, FormField, Empty, Badge } from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { pairingKeyFor } from '@/lib/backend/config';
import PatientAppointments from '@/components/patient-appointments';
import { PatientPairing } from './pairing';
export default function AccountWorkspace() {
  const {
    client,
    user,
    state,
    busy,
    run,
    reload,
    mode
  } = useStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]),
    [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [hospitalSessions, setHospitalSessions] = useState<Session[]>([]);
  const [qr, setQr] = useState<Qr | null>(null),
    [incoming, setIncoming] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('pair') || sessionStorage.getItem(pairingKeyFor(mode)) || '';
    if (token) {
      setIncoming(token);
      sessionStorage.removeItem(pairingKeyFor(mode));
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  const load = useCallback(async () => {
    if (user?.role === 'PATIENT') setPatient((await client.request<{
      myPatientProfile: Patient;
    }>(operations.patient)).myPatientProfile);
    if (user?.role === 'HOSPITAL_ADMIN') {
      const data = await client.request<{
        myHospital: Hospital;
        hospitalSessions: Session[];
      }>(operations.hospital);
      setHospital(data.myHospital);
      setHospitalSessions(data.hospitalSessions);
    }
    if (user?.role === 'SYSTEM_ADMIN') {
      const data = await client.request<{
        allHospitals: Hospital[];
        allPharmacies: Pharmacy[];
      }>(operations.system);
      setHospitals(data.allHospitals);
      setPharmacies(data.allPharmacies);
    }
  }, [client, user?.role]);
  useEffect(() => {
    let active = true;
    void load().catch(() => {
      if (active) setNotice('Could not load account details. Use Refresh.');
    });
    return () => {
      active = false;
    };
  }, [load, state]);
  if (!user) return null;
  const refresh = async () => {
    await reload();
    await load();
  };
  return <><PageHeading eyebrow="CONNECTED CARE" title={user.role === 'PATIENT' ? 'My care' : 'Administration'} description={`Welcome, ${user.name}. Your care team works from the same shared records.`} actions={<>{user.role === 'PATIENT' && user.profileComplete && <><a className="button" href="#patient-qr"><QrCode size={16} />My patient QR</a>{mode === 'simulation' && <Link className="button primary" href="/appointments?book=1"><Plus size={16} />Book appointment</Link>}</>}<button className="button" disabled={busy} onClick={() => run(refresh)}>Refresh</button></>} />
    {notice && <div className="simulation-success" role="status">{notice}</div>}
    {user.role === 'PATIENT' && (!user.profileComplete ? <Panel title="Complete your patient profile"><DataForm label="Complete profile" busy={busy} fields={mode === 'live' ? [['name', 'Full name', 'text'], ['dob', 'Date of birth', 'date'], ['sex', 'Sex', 'text'], ['allergies', 'Allergies', 'text']] : [["name", "Full name", "text"], ["age", "Age", "number"], ["gender", "Gender", "text"], ["bloodGroup", "Blood group", "text"], ["allergies", "Allergies", "text"]]} onSubmit={f => run(async () => {
        const result = await client.request<{
          completePatientProfile: BackendUser;
        }>(operations.profile, {
          input: {
            ...Object.fromEntries(f),
            age: Number(f.get('age'))
          }
        });
        if (client.auth) client.setAuth({
          ...client.auth,
          user: result.completePatientProfile
        });
        await refresh();
        setNotice('Patient profile completed.');
      })} /></Panel> : <>
      <div className="stats-grid"><Stat label="Patient wallet" value={money(state.wallet || 0)} detail="Available for consultations and medicine" icon={<Wallet size={20} />} accent /><Stat label="Medical sessions" value={patient?.sessions.length || 0} detail="Your shared clinical history" icon={<Stethoscope size={20} />} /><Stat label="Pending prescriptions" value={state.prescriptions.filter(r => r.status === 'Pending' && r.finalized).length} detail="Ready for the pharmacy" icon={<Pill size={20} />} /></div>
      <div id="patient-qr" className="patient-qr-anchor"><Panel title="Your patient QR" subtitle="Show this short-lived code to your doctor or pharmacist to look up your information securely."><div className="panel-body"><QrDisplay qr={qr} /><button className="button primary full-width" disabled={busy} onClick={() => run(async () => {
              setQr((await client.request<{
                generateQrToken: Qr;
              }>(operations.qr)).generateQrToken);
            })}><QrCode size={16} />{qr ? 'Generate a new patient QR' : 'Generate patient QR'}</button><p className="small-muted">The code expires shortly after it is generated. Your care team must scan it while it is active.</p></div></Panel></div>
      <PatientAppointments embedded />
      {mode === 'simulation' && <PatientPairing client={client} busy={busy} run={run} initialToken={incoming} />}
      <Panel title="Top up your wallet" subtitle={mode === 'simulation' ? 'Local test payments; no card details required.' : 'Wallet changes are processed by the live backend.'}><form className="panel-body simulation-form" onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await client.request(operations.topUp, {
                amount: Number(f.get('amount'))
              });
              await refresh();
              setNotice(mode === 'live' ? 'Live wallet updated.' : 'Wallet top-up completed.');
            });
          }}><FormField label="Top-up amount (ZAR)"><input name="amount" type="number" min="0.01" max="100000" step="0.01" defaultValue="500" required /></FormField><button className="button primary" disabled={busy}><Plus size={16} />{mode === 'simulation' ? 'Add simulated funds' : 'Add funds'}</button><Link href="/records" className="text-link">View my medical records <ArrowRight size={15} /></Link></form></Panel>
      <Panel title="My payments"><div className="panel-body">{state.payments?.slice().reverse().map(p => <div className="simulation-price" key={p.id}><span>{p.kind === 'CONSULTATION' ? 'Consultation' : p.kind === 'MEDICINE' ? 'Medicine' : 'Wallet top-up'}<small className="block-muted">{new Date(p.occurredAt).toLocaleString('en-ZA')}</small></span><strong>{money(p.amount)}</strong></div>)}{!state.payments?.length && <Empty title="No payments yet" />}</div></Panel>
      <History sessions={patient?.sessions || []} />
    </>)}
    {user.role === 'HOSPITAL_ADMIN' && <><div className="stats-grid"><Stat label="Hospital wallet" value={money(hospital?.wallet.balance || 0)} detail="Consultation payments received" icon={<Wallet size={20} />} accent /><Stat label="Consultation fee" value={money(hospital?.consultationFee || 0)} detail={hospital?.name || ''} icon={<Stethoscope size={20} />} /></div><div className="simulation-columns"><Panel title={hospital?.name || 'Hospital doctors'}><div className="panel-body">{hospital?.doctors.map(d => <div className="simulation-price" key={d.id}><strong>{d.user.name}</strong><span>{d.user.identifier}</span></div>)}</div></Panel><Panel title="Add a doctor"><DataForm label="Add doctor" busy={busy} fields={[["name", "Doctor name", "text"], ["identifier", "Doctor identifier", "text"]]} onSubmit={f => run(async () => {
            await client.request(operations.onboardDoctor, {
              input: Object.fromEntries(f)
            });
            await refresh();
            setNotice('Doctor added. They can sign in from the normal login page.');
          })} /></Panel></div>{mode === 'simulation' ? <History title="Hospital sessions" sessions={hospitalSessions} /> : <p className="small-muted">Hospital-wide session history is not exposed by this live API.</p>}</>}
    {user.role === 'SYSTEM_ADMIN' && <div className="simulation-columns"><Panel title="Hospitals"><div className="panel-body">{hospitals.map(h => <div className="simulation-price" key={h.id}><strong>{h.name}</strong><span>{h.address}</span></div>)}</div></Panel><Panel title="Pharmacies"><div className="panel-body">{pharmacies.map(p => <div className="simulation-price" key={p.id}><strong>{p.name}</strong><span>{p.address}</span></div>)}</div></Panel>
      <Panel title="Add a hospital"><DataForm label="Create hospital" busy={busy} fields={[["name", "Hospital name", "text"], ["address", "Hospital address", "text"], ["consultationFee", "Consultation fee (ZAR)", "number"], ["adminName", "Administrator name", "text"], ["adminIdentifier", "Administrator identifier", "text"]]} onSubmit={f => run(async () => {
          const input = Object.fromEntries(f);
          await client.request(operations.onboardHospital, {
            input: {
              ...input,
              consultationFee: Number(input.consultationFee)
            }
          });
          await refresh();
          setNotice('Hospital added. Its administrator can now sign in.');
        })} /></Panel>
      <Panel title="Add a pharmacy"><DataForm label="Create pharmacy" busy={busy} fields={[["name", "Pharmacy name", "text"], ["address", "Pharmacy address", "text"], ["userName", "Pharmacist name", "text"], ["userIdentifier", "Pharmacist identifier", "text"]]} onSubmit={f => run(async () => {
          await client.request(operations.onboardPharmacy, {
            input: Object.fromEntries(f)
          });
          await refresh();
          setNotice('Pharmacy added. Its pharmacist can now sign in.');
        })} /></Panel></div>}
  </>;
}
function DataForm({
  fields,
  label,
  busy,
  onSubmit
}: {
  fields: string[][];
  label: string;
  busy: boolean;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [dates, setDates] = useState<Record<string, string>>({});
  return <form className="panel-body simulation-form" onSubmit={e => {
    e.preventDefault();
    void onSubmit(new FormData(e.currentTarget));
  }}>{fields.map(([name, title, type]) => <FormField label={title} key={name}>{type === 'date' ? <DatePicker label={title} name={name} value={dates[name] || ''} onChange={value => setDates(d => ({
        ...d,
        [name]: value
      }))} max={new Date().toISOString().slice(0, 10)} /> : <input name={name} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} required maxLength={200} />}</FormField>)}<button className="button primary" disabled={busy}>{label}</button></form>;
}
function QrDisplay({
  qr
}: {
  qr: Qr | null;
}) {
  const [image, setImage] = useState('');
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    let active = true;
    setImage('');
    if (qr) QRCode.toDataURL(qr.qrCodeUrl, {
      width: 420,
      margin: 2,
      color: {
        dark: '#06543e',
        light: '#ffffff'
      }
    }).then(value => {
      if (active) setImage(value);
    });
    return () => {
      active = false;
    };
  }, [qr]);
  useEffect(() => {
    if (!qr) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [qr]);
  return <div className="simulation-qr">{image ? <img src={image} alt="Expiring patient QR code" width={210} height={210} /> : <div className="simulation-qr-placeholder"><QrCode size={55} /><p>Generate your QR when you need to share it.</p></div>}{qr && <><span className={remaining ? '' : 'danger-text'}>{remaining ? `Expires in ${remaining}s` : 'Expired — refresh and rescan'}</span><label>Scan URL<input aria-label="Scan URL" readOnly value={qr.qrCodeUrl} onFocus={e => e.target.select()} /></label><small>Copy this URL into the doctor or pharmacy tab. You can also scan the displayed QR with a separate device.</small></>}</div>;
}
function History({
  sessions,
  title = 'Session history'
}: {
  sessions: Session[];
  title?: string;
}) {
  return <Panel title={title}><div className="panel-body">{!sessions.length && <Empty title="No sessions yet" text="Your consultation history will appear here." />}{sessions.slice().reverse().map(s => <div className="simulation-history" key={s.id}><div><h3>{s.patient.user.name} · {s.doctor.user.name}</h3><Badge>{s.status === 'ACTIVE' ? 'In progress' : 'Completed'}</Badge></div><small>{new Date(s.startedAt).toLocaleString('en-ZA')} · {s.id}</small><p>{s.diagnosis?.notes || 'No diagnosis recorded.'}</p>{s.prescription?.items.map(i => <p key={i.id}><Pill size={13} />{i.drugName} · {i.quantity} units · {i.status === 'PENDING' ? 'Pending' : 'Dispensed'}</p>)}</div>)}</div></Panel>;
}

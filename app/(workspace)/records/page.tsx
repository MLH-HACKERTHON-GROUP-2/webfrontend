'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search, FolderHeart, Stethoscope, Pill, CalendarDays, FileText, ArrowUpRight, Download, Activity, Clock3 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dateLabel } from '@/lib/data';
import { PageHeading, Panel, Avatar, Badge, Empty, downloadCSV } from '@/components/ui';
import PatientBanner from '@/components/patient-banner';
export default function Records() {
  const searchParams = useSearchParams();
  const {
    state, user, mode
  } = useStore();
  const [patientId, setPatientId] = useState('PT-1001');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Overview');
  useEffect(() => {
    const id = searchParams.get('patient');
    if (id && state.patients.some(p => p.id === id)) setPatientId(id);
  }, [searchParams, state.patients]);
  const patient = state.patients.find(p => p.id === patientId) || state.patients[0];
  const selectedId = patient?.id;
  const diagnoses = state.diagnoses.filter(d => d.patientId === selectedId);
  const rx = state.prescriptions.filter(r => r.patientId === selectedId);
  const visits = (mode === 'live' ? (state.sessions || []).filter(s => s.patientId === selectedId).map(s => { const source = state.diagnoses.find(d => d.id === `DX-${s.id}`); return { id: s.id, patientId: s.patientId, date: s.startedAt?.slice(0, 10) || '', time: s.startedAt?.slice(11, 16) || '', type: 'Consultation', status: s.status === 'ACTIVE' ? 'In progress' : 'Completed', reason: source?.notes || 'Clinical session' }; }) : state.appointments.filter(a => a.patientId === selectedId)).sort((a, b) => b.date.localeCompare(a.date));
  const notes = state.notes.filter(n => n.patientId === selectedId);
  if (!patient) return <><PageHeading title="Patient medical records" description="Connect a patient to view their medical information." /><Empty title="No patient connected" text={mode === 'live' ? 'Scan the patient’s current QR in Patient connections to view authorized records.' : 'Use Patient connections to generate a QR and ask your patient to approve access.'} /></>;
  function exportRecord() {
    downloadCSV(`${patient.id}-medical-record.csv`, ['Record type', 'Date', 'Detail', 'Status / notes'], [...diagnoses.map(d => ['Diagnosis', d.date, `${d.name} (${d.code})`, d.notes]), ...rx.map(r => ['Prescription', r.date, state.medicines.find(m => m.id === r.medicineId)!.name, `${r.quantity} units · ${r.dosage} · ${r.status}`]), ...notes.map(n => ['Clinical note', n.date, n.text, '']), ...visits.map(a => [mode === 'live' ? 'Clinical session' : 'Appointment', a.date, a.reason, a.status])]);
  }
  return <><PageHeading eyebrow="THE PERSON BEHIND THE RECORD" title="Patient medical records" description="Their story, their health, all in one place." actions={<button className="button" onClick={exportRecord}><Download size={16} /> Export record</button>} /><div className="records-layout"><Panel className="patient-directory" title="Your patients" action={<span className="count-chip">{state.patients.length}</span>}><div className="local-search directory-search"><Search size={17} /><input aria-label="Search medical records" placeholder="Find a patient…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="patient-list">{state.patients.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(query.toLowerCase())).map(p => <button className={`patient-list-item ${patientId === p.id ? 'selected' : ''}`} onClick={() => {
            setPatientId(p.id);
            setTab('Overview');
          }} key={p.id}><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{p.id} · {p.age} years</small></span>{patientId === p.id && <span className="active-dot" />}</button>)}{!state.patients.some(p => (p.name + ' ' + p.id).toLowerCase().includes(query.toLowerCase())) && <Empty />}</div><div className="directory-footer"><FolderHeart size={18} /><span>Every record tells a story.</span></div></Panel><div className="record-detail"><PatientBanner patient={patient} /><div className="tabs">{['Overview', 'Diagnoses', 'Prescriptions', 'Visit history', 'Clinical notes'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>{tab === 'Overview' ? <><div className="record-summary-grid">{[{
              label: 'Recorded diagnoses',
              value: diagnoses.length,
              icon: Stethoscope
            }, {
              label: 'Prescriptions',
              value: rx.length,
              icon: Pill
            }, {
              label: 'Total visits',
              value: visits.length,
              icon: CalendarDays
            }].map(({
              label,
              value,
              icon: Icon
            }) => <div className="record-summary" key={label}><span className="record-icon"><Icon size={21} /></span><div><strong>{value}</strong><span>{label}</span></div></div>)}</div><Panel title="Patient information" action={user?.role === 'DOCTOR' ? <Link className="text-link" href={`/session?patient=${patient.id}`}>Open consultation <ArrowUpRight size={15} /></Link> : undefined}><div className="detail-grid patient-info-grid"><div><span>Full name</span><strong>{patient.name}</strong></div><div><span>Patient ID</span><strong>{patient.id}</strong></div><div><span>Age / gender</span><strong>{patient.age} years · {patient.gender}</strong></div><div><span>Blood group</span><strong>{patient.blood}</strong></div><div><span>Primary case</span><strong>{patient.case}</strong></div><div><span>Allergies</span><strong className={patient.allergies !== 'None known' ? 'danger-text' : ''}>{patient.allergies}</strong></div></div></Panel><Panel title="Recent activity" subtitle="The latest chapters in their care"><div className="panel-body">{[...diagnoses.map(d => ({
                id: d.id,
                date: d.date,
                title: d.name,
                text: d.notes,
                icon: Stethoscope
              })), ...notes.map(n => ({
                id: n.id,
                date: n.date,
                title: 'Clinical note',
                text: n.text,
                icon: FileText
              })), ...rx.map(r => ({
                id: r.id,
                date: r.date,
                title: `${state.medicines.find(m => m.id === r.medicineId)!.name} prescribed`,
                text: `${r.quantity} units · ${r.status}`,
                icon: Pill
              }))].sort((a, b) => b.date.localeCompare(a.date)).map(({
                id,
                date,
                title,
                text,
                icon: Icon
              }) => <div className="record-timeline-item" key={id}><span className="record-icon"><Icon size={18} /></span><div><span className="small-muted">{dateLabel(date)}</span><h3>{title}</h3><p>{text}</p></div></div>)}{!diagnoses.length && !notes.length && !rx.length && <Empty title="A new chapter starts here" text="This patient has no recorded clinical activity yet." />}</div></Panel></> : tab === 'Diagnoses' ? <Panel title="Diagnosis history"><div className="panel-body">{diagnoses.map(d => <div className="record-item" key={d.id}><span className="record-icon"><Stethoscope size={20} /></span><div><h3>{d.name} <span className="code-tag">{d.code}</span></h3><p>{d.notes}</p><small>{dateLabel(d.date)}</small></div></div>)}{!diagnoses.length && <Empty title="No diagnoses recorded" />}</div></Panel> : tab === 'Prescriptions' ? <Panel title="Prescription history"><div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Instructions</th><th>Qty</th><th>Status</th></tr></thead><tbody>{rx.map(r => {
                  const m = state.medicines.find(m => m.id === r.medicineId)!;
                  return <tr key={r.id}><td><strong>{m.name}</strong><small className="block-muted">{m.strength} · {dateLabel(r.date)}</small></td><td>{r.dosage}<small className="block-muted">{r.duration}</small></td><td>{r.quantity}</td><td><Badge>{r.status}</Badge></td></tr>;
                })}</tbody></table>{!rx.length && <Empty title="No prescriptions recorded" />}</div></Panel> : tab === 'Visit history' ? <Panel title={mode === 'live' ? 'Clinical session history' : 'Appointment & visit history'}><div className="panel-body">{visits.map(a => <div className="visit-item" key={a.id}><span className="record-icon"><CalendarDays size={19} /></span><div><h3>{a.type}</h3><p>{a.reason}</p><small>{dateLabel(a.date)} · {a.time}</small></div><Badge>{a.status}</Badge></div>)}{!visits.length && <Empty title="No visits recorded" />}</div></Panel> : <Panel title="Clinical notes"><div className="panel-body">{notes.slice().reverse().map(n => <div className="timeline-note" key={n.id}><span>{dateLabel(n.date)} · {state.profile.name}</span><p>{n.text}</p></div>)}{!notes.length && <Empty title="No clinical notes recorded" />}</div></Panel>}</div></div></>;
}

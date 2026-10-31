'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Stethoscope, Pill, HeartPulse, Thermometer, Activity, Wind, Weight, CheckCircle2, Save, Clock3, ArrowLeft, FileText } from 'lucide-react';
import { useStore } from '@/lib/store';
import { operations } from '@/lib/backend/operations';
import { ConnectionsPanel } from '@/components/backend/connections';
import { dateLabel, TODAY } from '@/lib/data';
import { PageHeading, Panel, Modal, FormField, ErrorMessage, Badge, Toast, Empty } from '@/components/ui';
import PatientBanner from '@/components/patient-banner';
export default function Session() {
  const searchParams = useSearchParams();
  const {
    state,
    addPrescription,
    addDiagnosis,
    saveNote,
    updateAppointment, startVisit, saveVitals, run, busy, client, reload, user, mode
  } = useStore();
  const [patientId, setPatientId] = useState('PT-1001');
  const [appointmentId, setAppointmentId] = useState('');
  const [modal, setModal] = useState<'diagnosis' | 'prescription' | 'complete' | 'vitals' | null>(null);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const q = searchParams;
    const id = q.get('patient');
    if (id && state.patients.some(p => p.id === id)) setPatientId(id);
    setAppointmentId(q.get('appointment') || '');
  }, [searchParams, state.patients]);
  const patient = state.patients.find(p => p.id === patientId);
  const activeSession = state.sessions?.find(s => s.patientId === patientId && s.doctorId === user?.id && s.status === 'ACTIVE');
  const appointment = state.appointments.find(a => a.id === appointmentId && a.patientId === patientId) || state.appointments.find(a => a.patientId === patientId && a.date === TODAY && a.status !== 'Cancelled');
  const diagnoses = state.diagnoses.filter(d => d.patientId === patientId);
  const prescriptions = state.prescriptions.filter(r => r.patientId === patientId);
  const closed = !activeSession;
  if (!patient) return <><PageHeading title="Patient consultation" description="Connect your patient before starting their care." /><ConnectionsPanel /></>;
  async function submitDiagnosis(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try { await addDiagnosis({
      patientId,
      name: String(f.get('name')).trim(),
      code: String(f.get('code')).trim(),
      notes: String(f.get('notes')).trim()
    });
    setModal(null);
    setToast('Diagnosis added to the patient’s medical record');
    } catch (e) { setError((e as Error).message); }
  }
  async function submitPrescription(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const quantity = Number(f.get('quantity'));
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Enter a positive whole quantity.');
      return;
    }
    try { await addPrescription({
      patientId,
      medicineId: mode === 'live' ? `live:${String(f.get('medicine')).trim()}` : String(f.get('medicine')),
      quantity,
      dosage: String(f.get('dosage')).trim(),
      duration: String(f.get('duration')).trim(),
      instructions: String(f.get('instructions')).trim()
    });
    setModal(null);
    setToast('Prescription saved. Complete the visit to release it to the pharmacy.');
    } catch (e) { setError((e as Error).message); }
  }
  return <><Link href="/appointments" className="back-link"><ArrowLeft size={14} /> Back to appointments</Link><PageHeading eyebrow="THOUGHTFUL CARE STARTS HERE" title="Patient consultation" description="The right information. More time for your patient." actions={<><select aria-label="Select patient for consultation" value={patientId} onChange={e => {
        setPatientId(e.target.value);
        setAppointmentId('');
        setNotes('');
      }}>{state.patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="button primary" disabled={busy || !activeSession} onClick={() => setModal('complete')}><CheckCircle2 size={16} /> {activeSession ? 'Complete visit' : 'Start visit below'}</button></>} /><PatientBanner patient={patient} /><div className="consultation-status"><span><i />{activeSession ? 'Active consultation' : 'Consultation workspace'}</span><span><Clock3 size={14} />{appointment ? `${dateLabel(appointment.date)} · ${appointment.time} · ${appointment.type}` : 'No active appointment · Record review'}</span>{appointment && <Badge>{appointment.status}</Badge>}{!activeSession && <button className="text-link" disabled={busy} onClick={() => run(async () => {
        await startVisit(patientId, appointment && !['Completed', 'Cancelled'].includes(appointment.status) ? appointment.id : undefined);
        setToast('Consultation started');
      })}>Start visit <Stethoscope size={15} /></button>}</div><div className="section-title"><h2>Vitals at a glance</h2><span>Recorded measurements for this visit</span></div><div className="vitals-grid">{[{
        label: 'Blood pressure',
        value: activeSession?.vitals?.bloodPressure ?? '—',
        unit: 'mmHg',
        icon: HeartPulse
      }, {
        label: 'Heart rate',
        value: activeSession?.vitals?.heartRate ?? '—',
        unit: 'bpm',
        icon: Activity
      }, {
        label: 'Temperature',
        value: activeSession?.vitals?.temperature ?? '—',
        unit: '°C',
        icon: Thermometer
      }, {
        label: 'Oxygen saturation',
        value: activeSession?.vitals?.oxygenSaturation ?? '—',
        unit: '%',
        icon: Wind
      }, {
        label: 'Weight',
        value: activeSession?.vitals?.weight ?? '—',
        unit: 'kg',
        icon: Weight
      }].map(({
        label,
        value,
        unit,
        icon: Icon
      }) => <div className="vital-card" key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{value}<small>{unit}</small></strong><span className="vital-caption">Recorded vital</span></div>)}</div><button className="button" disabled={closed || busy} onClick={() => setModal('vitals')}>Record vitals</button><div className="consultation-grid"><div><Panel title="Presenting complaint" subtitle="The reason for today’s visit" action={<Stethoscope size={19} className="muted" />}><div className="panel-body"><p className="complaint-text">{appointment?.reason || patient.case + ' — clinical record review'}</p><span className="small-muted">Clinical history: {patient.case}</span></div></Panel><Panel title="Clinical notes" subtitle="Your observations, assessment and plan" action={<FileText size={19} className="muted" />}><div className="panel-body"><label className="sr-only" htmlFor="clinical-notes">Clinical notes</label><textarea id="clinical-notes" className="clinical-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add your clinical observations, examination findings and care plan…" maxLength={5000} /><div className="notes-footer"><span>Saved notes appear in the medical record.</span><button className="button primary small" disabled={closed || busy || !notes.trim()} onClick={() => run(async () => {
                await saveNote(patientId, notes.trim());
                setNotes('');
                setToast('Clinical note saved');
              })}><Save size={15} /> Save note</button></div></div></Panel><Panel title="Diagnosis" subtitle="A clearer understanding of their health" action={<button className="button small" disabled={closed || busy} onClick={() => { setError(''); setModal('diagnosis'); }}><Plus size={15} /> Add diagnosis</button>}><div className="panel-body">{diagnoses.length ? diagnoses.map(d => <div className="record-item" key={d.id}><span className="record-icon"><Stethoscope size={20} /></span><div><h3>{d.name} <span className="code-tag">{d.code || 'Uncoded'}</span></h3><p>{d.notes}</p><small>{dateLabel(d.date)} · {state.profile.name}</small></div></div>) : <Empty title="No diagnoses recorded" text="Add a diagnosis after your assessment." />}</div></Panel></div><div><Panel title="Prescriptions" subtitle="Connected directly to your pharmacy" action={<button className="icon-button" aria-label="Add prescription" disabled={closed || busy} onClick={() => {
          setError('');
          setModal('prescription');
        }}><Plus size={19} /></button>}><div className="panel-body">{prescriptions.map(rx => {
              const med = state.medicines.find(m => m.id === rx.medicineId)!;
              return <div className="prescription-card" key={rx.id}><div className="prescription-heading"><span className="record-icon"><Pill size={20} /></span><Badge>{rx.status}</Badge></div><h3>{med.name} <span>{med.strength}</span></h3><p>{rx.dosage} · {rx.duration}</p><div className="prescription-meta"><span>Quantity: <b>{rx.quantity}</b></span><span>{dateLabel(rx.date)}</span></div><p className="prescription-instructions">{rx.instructions || 'No additional instructions recorded.'}</p></div>;
            })}{!prescriptions.length && <Empty title="No prescriptions yet" text="Add a prescription to send it to the pharmacy." />}<button className="button dashed full-width" disabled={closed || busy} onClick={() => {
              setError('');
              setModal('prescription');
            }}><Plus size={16} /> New prescription</button></div></Panel><Panel title="Previous notes" subtitle="A little context goes a long way"><div className="panel-body">{state.notes.filter(n => n.patientId === patientId).slice().reverse().slice(0, 3).map(n => <div className="timeline-note" key={n.id}><span>{dateLabel(n.date)}</span><p>{n.text}</p></div>)}{!state.notes.some(n => n.patientId === patientId) && <p className="muted">No previous notes for this patient.</p>}<Link href={`/records?patient=${patientId}`} className="text-link">View full medical record →</Link></div></Panel></div></div>{modal === 'diagnosis' && <Modal title="Add diagnosis" description={`Record your assessment for ${patient.name}.`} onClose={() => setModal(null)}><form onSubmit={submitDiagnosis}><ErrorMessage message={error} /><div className="form-grid"><FormField label="Diagnosis" wide><input name="name" placeholder="Enter diagnosis" required maxLength={150} /></FormField><FormField label="ICD-10 code (optional)" wide><input name="code" placeholder="e.g. I10" maxLength={20} /></FormField><FormField label="Clinical assessment" wide><textarea name="notes" placeholder="Supporting findings and assessment…" maxLength={3000} required /></FormField></div><div className="modal-actions"><button className="button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary">Save diagnosis</button></div></form></Modal>}{modal === 'prescription' && <Modal title="New prescription" description={`Create a prescription for ${patient.name}.`} onClose={() => setModal(null)}><form onSubmit={submitPrescription}><div className="form-grid"><div className={`inline-alert full ${patient.allergies === 'None known' ? 'neutral' : ''}`}>Allergies: {patient.allergies}</div><FormField label="Medicine" wide>{mode === 'live' ? <input name="medicine" required placeholder="Enter the prescribed medicine name" maxLength={150} /> : <select name="medicine" required defaultValue=""><option value="" disabled>Select from the medicine catalog</option>{state.medicines.map(m => <option key={m.id} value={m.id}>{m.name} {m.strength} · {m.stock} in stock</option>)}</select>}</FormField><FormField label="Dosage / frequency" wide><input name="dosage" placeholder="Enter the clinician’s dosage instructions" required maxLength={200} /></FormField><FormField label="Quantity"><input name="quantity" type="number" min="1" max="10000" step="1" required /></FormField><FormField label="Duration"><input name="duration" placeholder="e.g. 7 days" required maxLength={80} /></FormField><FormField label="Additional instructions" wide><textarea name="instructions" placeholder="Enter patient-specific instructions" maxLength={2000} /></FormField></div><ErrorMessage message={error} /><div className="modal-actions"><button className="button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary">Create prescription</button></div></form></Modal>}{modal === 'complete' && <Modal title="Complete this visit?" description="The consultation fee will be charged to the patient wallet and the visit will be marked completed." onClose={() => setModal(null)}><div className="panel-body"><p>{notes.trim() ? 'Your unsaved clinical note will be saved with this visit.' : 'All saved diagnoses and prescriptions will stay in the patient’s record.'}</p><p className="small-muted">Pending prescriptions remain available to the pharmacy.</p></div><div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Keep working</button><button className="button primary" disabled={busy} onClick={() => run(async () => {
          if (notes.trim()) {
            await saveNote(patientId, notes.trim());
            setNotes('');
          }
          if (!activeSession) throw Error('Start this patient’s visit first.');
          await client.request(operations.finalize, { sessionId: activeSession.id });
          await reload();
          setModal(null);
          setToast('Visit completed. Patient records and consultation payment are up to date.');
        })}>Complete visit</button></div></Modal>}{modal === 'vitals' && <Modal title="Record vitals" description="Save measurements taken during this visit." onClose={() => setModal(null)}><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { const number = (key: string) => f.get(key) ? Number(f.get(key)) : null; await saveVitals(patientId, { bloodPressure: String(f.get('bloodPressure') || '') || null, heartRate: number('heartRate'), temperature: number('temperature'), oxygenSaturation: number('oxygenSaturation'), weight: number('weight') }); setModal(null); setToast('Vitals saved'); }); }}><div className="form-grid"><FormField label="Blood pressure"><input name="bloodPressure" defaultValue={activeSession?.vitals?.bloodPressure || ''} placeholder="e.g. 120/80" /></FormField>{[['heartRate','Heart rate (bpm)'], ['temperature','Temperature (°C)'], ['oxygenSaturation','Oxygen saturation (%)'], ['weight','Weight (kg)']].filter(([name]) => mode !== 'live' || name !== 'oxygenSaturation').map(([name, label]) => <FormField key={name} label={label}><input name={name} type="number" min="0" step={name === 'heartRate' || name === 'oxygenSaturation' ? '1' : '0.1'} /></FormField>)}</div><div className="modal-actions"><button className="button primary" disabled={busy}>Save vitals</button></div></form></Modal>}{toast && <Toast message={toast} onClose={() => setToast('')} />}</>;
}

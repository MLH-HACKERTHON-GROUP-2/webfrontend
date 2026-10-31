'use client';

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { TODAY, money } from '@/lib/data';
import { DatePicker } from './ui/date-picker';
import { Select } from './ui/select';
import { Modal, FormField, ErrorMessage } from './ui';
export function AppointmentForm({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    state,
    addAppointment, user, busy
  } = useStore();
  const [error, setError] = useState('');
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState('');
  const [hospitalId, setHospitalId] = useState(''), [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);
  const isPatient = user?.role === 'PATIENT';
  const providers = state.appointmentProviders || [];
  const hospitals = [...new Map(providers.map(d => [d.hospitalId, { value: d.hospitalId, label: d.hospitalName }])).values()];
  const selectedDoctor = providers.find(d => d.id === doctorId && d.hospitalId === hospitalId);

  const timeSlots = Array.from({ length: 35 }, (_, i) => {
    const minutes = 8 * 60 + i * 15;
    const value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return { value, label: value };
  });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = String(f.get('date'));
    if (saving) return;
    if (isPatient && !selectedDoctor) { setError('Choose a hospital and doctor.'); return; }
    if (!date || !time) {
      setError('Choose an appointment date and time.');
      return;
    }
    if (date < TODAY) {
      setError('Choose today or a future date.');
      return;
    }
    setSaving(true); setError('');
    try {
    if (!await addAppointment({
      patientId: isPatient ? state.patients[0]?.id || '' : String(f.get('patient')),
      ...(isPatient ? { doctorId } : {}),
      date,
      time: String(f.get('time')),
      type: String(f.get('type')),
      reason: String(f.get('reason')).trim()
    })) {
      setError('This time is already booked or overlaps an existing visit. Choose another slot.');
      return;
    }
    onSaved();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Modal title={isPatient ? 'Book an appointment' : 'New appointment'} description="Make time for a little better care." onClose={onClose}><form onSubmit={submit}><div className="form-grid">{isPatient ? <><FormField label="Hospital" wide><Select label="Hospital" name="hospitalId" value={hospitalId} onValueChange={value => { setHospitalId(value); setDoctorId(''); }} options={hospitals} placeholder="Choose your hospital" required /></FormField><FormField label="Doctor" wide><Select label="Doctor" name="doctorId" value={doctorId} onValueChange={setDoctorId} options={providers.filter(d => d.hospitalId === hospitalId).map(d => ({ value: d.id, label: d.name }))} disabled={!hospitalId} placeholder="Choose your doctor" required /></FormField>{selectedDoctor && <p className="small-muted full">Consultation fee: {money(selectedDoctor.consultationFee)}. Your wallet is charged when the consultation is completed.</p>}</> : <FormField label="Patient" wide><select name="patient" required defaultValue=""><option value="" disabled>Select a patient</option>{state.patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}</select></FormField>}<FormField label="Appointment type" wide><select name="type"><option>Consultation</option><option>Follow-up</option><option>General checkup</option></select></FormField><div className="field"><label htmlFor="appointment-date">Date</label><DatePicker id="appointment-date" label="Appointment date" name="date" value={date} onChange={setDate} min={TODAY} required /></div><div className="field"><label htmlFor="appointment-time">Time</label><Select id="appointment-time" label="Appointment time" name="time" value={time} onValueChange={setTime} options={timeSlots} placeholder="Choose a time" required /></div><FormField label="Reason for visit" wide><textarea name="reason" placeholder="Describe the reason for this appointment" required maxLength={500} /></FormField></div><ErrorMessage message={error} /><div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || busy}>{saving ? 'Booking…' : 'Book appointment'}</button></div></form></Modal>;
}

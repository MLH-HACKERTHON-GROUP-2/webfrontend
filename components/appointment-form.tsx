'use client';

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { TODAY } from '@/lib/data';
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
    addAppointment
  } = useStore();
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = String(f.get('date'));
    if (date < TODAY) {
      setError('Choose today or a future date.');
      return;
    }
    if (!addAppointment({
      patientId: String(f.get('patient')),
      date,
      time: String(f.get('time')),
      type: String(f.get('type')),
      reason: String(f.get('reason')).trim()
    })) {
      setError('This time is already booked or overlaps an existing visit. Choose another slot.');
      return;
    }
    onSaved();
  }
  return <Modal title="New appointment" description="Make time for a little better care." onClose={onClose}><form onSubmit={submit}><div className="form-grid"><FormField label="Patient" wide><select name="patient" required defaultValue=""><option value="" disabled>Select a patient</option>{state.patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}</select></FormField><FormField label="Appointment type" wide><select name="type"><option>Consultation</option><option>Follow-up</option><option>General checkup</option></select></FormField><FormField label="Date"><input type="date" name="date" defaultValue={TODAY} min={TODAY} required /></FormField><FormField label="Time"><input type="time" name="time" min="08:00" max="16:30" step="900" required /></FormField><FormField label="Reason for visit" wide><textarea name="reason" placeholder="Describe the reason for this appointment" required maxLength={500} /></FormField></div><ErrorMessage message={error} /><div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary">Book appointment</button></div></form></Modal>;
}

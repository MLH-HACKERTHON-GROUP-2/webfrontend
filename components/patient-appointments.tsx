'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dateLabel, type Appointment } from '@/lib/data';
import { AppointmentForm } from './appointment-form';
import { Badge, Empty, Modal, PageHeading, Panel, Toast } from './ui';

export default function PatientAppointments({ embedded = false }: { embedded?: boolean }) {
  const { state, mode, user, updateAppointment, run, busy } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [booking, setBooking] = useState(!embedded && params.get('book') === '1');
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState('');
  const closeBooking = () => {
    setBooking(false);
    if (!embedded && params.has('book')) router.replace('/appointments');
  };
  const canBook = mode === 'simulation' && user?.profileComplete && !!state.appointmentProviders?.length;
  const appointments = state.appointments.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const bookButton = <button className="button primary" disabled={!canBook || busy} onClick={() => setBooking(true)}><Plus size={16} />Book appointment</button>;
  return <>
    {!embedded && <PageHeading eyebrow="MAKE TIME FOR YOUR HEALTH" title="My appointments" description="Choose your hospital and doctor, book a visit, and keep track of your care." actions={bookButton} />}
    <Panel title={embedded ? 'My appointments' : 'Your visits'} subtitle="Your bookings appear in your doctor's appointment book." action={embedded ? bookButton : <CalendarDays size={19} />}>
      {mode === 'live' ? <div className="panel-body"><p>Online appointment booking is not available with the connected service yet.</p><p className="small-muted">Please contact your hospital to arrange a visit. You can try patient booking by signing in with Simulation mode.</p></div> : !user?.profileComplete ? <div className="panel-body"><p>Complete your patient profile before booking a visit.</p></div> : <div className="panel-body patient-appointment-list">
        {!state.appointmentProviders?.length && <p className="small-muted">No doctors are available to book yet. Please contact your hospital.</p>}
        {appointments.map(a => <article className="patient-appointment" key={a.id}>
          <div className="patient-appointment-heading"><div><h3>{a.doctorName || 'Doctor'}</h3><p>{a.hospitalName || 'Hospital'}</p></div><Badge>{a.status}</Badge></div>
          <p><CalendarDays size={15} />{dateLabel(a.date)} · {a.time} SAST · {a.type}</p><p>{a.reason}</p>
          {['Confirmed', 'Waiting'].includes(a.status) && <button className="text-link danger-text" disabled={busy} onClick={() => setCancel(a)}>Cancel appointment</button>}
        </article>)}
        {!appointments.length && <Empty title="No appointments yet" text="Choose Book appointment to arrange your first visit." />}
      </div>}
    </Panel>
    {booking && canBook && <AppointmentForm onClose={closeBooking} onSaved={() => { closeBooking(); setNotice('Appointment booked. Your doctor’s schedule is updated.'); }} />}
    {cancel && <Modal title="Cancel this appointment?" description={`${cancel.doctorName || 'Doctor'} · ${dateLabel(cancel.date)} at ${cancel.time} SAST`} onClose={() => setCancel(null)}><div className="panel-body"><p>Your hospital and doctor will see the cancellation.</p></div><div className="modal-actions"><button className="button" disabled={busy} onClick={() => setCancel(null)}>Keep appointment</button><button className="button danger" disabled={busy} onClick={() => run(async () => { await updateAppointment(cancel.id, 'Cancelled'); setCancel(null); setNotice('Appointment cancelled. Your doctor’s schedule is updated.'); })}>Confirm cancellation</button></div></Modal>}
    {notice && <Toast message={notice} onClose={() => setNotice('')} />}
  </>;
}

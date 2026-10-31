'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Search, List, CalendarDays, ChevronLeft, ChevronRight, ArrowUpRight, Download, Clock3, CheckCircle2, XCircle, CalendarCheck2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { TODAY, dateLabel, type Appointment } from '@/lib/data';
import { PageHeading, Panel, Avatar, Badge, Stat, Toast, Empty, Modal, downloadCSV } from '@/components/ui';
import { AppointmentForm } from '@/components/appointment-form';
export default function Appointments() {
  const {
    state,
    updateAppointment
  } = useStore();
  const [booking, setBooking] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [range, setRange] = useState('Today');
  const [view, setView] = useState('list');
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const filtered = state.appointments.filter(a => {
    const p = state.patients.find(p => p.id === a.patientId)!;
    return (p.name + ' ' + p.id + ' ' + a.id).toLowerCase().includes(query.toLowerCase()) && (status === 'All statuses' || a.status === status) && (range === 'All dates' || (range === 'Today' ? a.date === TODAY : range === 'Upcoming' ? a.date >= TODAY : a.date < TODAY));
  }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  function move(n: number) {
    const date = new Date(year, month + n, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  }
  function exportData() {
    downloadCSV('emerald-appointments.csv', ['Appointment', 'Patient', 'Date', 'Time', 'Type', 'Status'], filtered.map(a => [a.id, state.patients.find(p => p.id === a.patientId)!.name, a.date, a.time, a.type, a.status]));
  }
  return <><PageHeading eyebrow="A LITTLE PLANNING. BETTER CARE." title="Appointments" description="Keep your day organized and your patients connected." actions={<><button className="button" onClick={exportData}><Download size={16} /> Export</button><button className="button primary" onClick={() => setBooking(true)}><Plus size={17} /> New appointment</button></>} /><div className="stats-grid"><Stat label="All appointments" value={state.appointments.length} detail="Across your practice" icon={<CalendarDays size={19} />} accent /><Stat label="Upcoming" value={state.appointments.filter(a => a.date >= TODAY && !['Completed', 'Cancelled'].includes(a.status)).length} detail="Ready for your care" icon={<Clock3 size={19} />} /><Stat label="Completed" value={state.appointments.filter(a => a.status === 'Completed').length} detail="Visits successfully concluded" icon={<CheckCircle2 size={19} />} /><Stat label="Cancelled" value={state.appointments.filter(a => a.status === 'Cancelled').length} detail="Available to rebook" icon={<XCircle size={19} />} /></div><Panel title="Your appointment book" subtitle="A clear view of every visit" action={<div className="segmented"><button aria-label="List view" className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><List size={17} /></button><button aria-label="Calendar view" className={view === 'calendar' ? 'selected' : ''} onClick={() => {
        setView('calendar');
        setRange('All dates');
      }}><CalendarDays size={17} /></button></div>}><div className="table-toolbar"><div className="local-search"><Search size={17} /><input aria-label="Search appointments" placeholder="Search patient or appointment…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="filter-group"><select aria-label="Appointment status" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses', 'Confirmed', 'Waiting', 'In progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Appointment date range" value={range} onChange={e => setRange(e.target.value)}>{['Today', 'Upcoming', 'Past', 'All dates'].map(s => <option key={s}>{s}</option>)}</select></div></div>{view === 'list' ? <><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Date & time</th><th>Visit type</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(a => {
                const p = state.patients.find(p => p.id === a.patientId)!;
                return <tr key={a.id}><td><div className="person-cell"><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{a.id}</small></span></div></td><td><strong className="table-date">{dateLabel(a.date)}</strong><small className="block-muted"><Clock3 size={12} /> {a.time} · 30 minutes</small></td><td>{a.type}</td><td className="reason-cell">{a.reason}</td><td><Badge>{a.status}</Badge></td><td><button className="text-link" onClick={() => setSelected(a)}>View details <ArrowUpRight size={15} /></button></td></tr>;
              })}</tbody></table></div>{!filtered.length && <Empty />}<div className="table-footer">Showing {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}<span>All times in South Africa Standard Time (UTC+2)</span></div></> : <><div className="big-calendar-title"><button className="icon-button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={19} /></button><h2>{new Date(year, month, 1).toLocaleDateString('en-ZA', {
              month: 'long',
              year: 'numeric'
            })}</h2><button className="icon-button" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={19} /></button><button className="button small" onClick={() => {
            setMonth(9);
            setYear(2026);
          }}>This month</button></div><div className="big-calendar">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <div className="calendar-weekday" key={d}>{d.slice(0, 3)}</div>)}{Array.from({
            length: first
          }, (_, i) => <div className="calendar-day outside" key={`b${i}`} />)}{Array.from({
            length: days
          }, (_, i) => {
            const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const visits = filtered.filter(a => a.date === d);
            return <div className={`calendar-day ${d === TODAY ? 'today' : ''}`} key={d}><span className="calendar-day-number">{i + 1}</span>{visits.map(a => <button className={`calendar-event ${a.status === 'Cancelled' ? 'cancelled' : ''}`} onClick={() => setSelected(a)} key={a.id}><b>{a.time}</b> {state.patients.find(p => p.id === a.patientId)!.name}</button>)}</div>;
          })}</div></>}</Panel>{booking && <AppointmentForm onClose={() => setBooking(false)} onSaved={() => {
      setBooking(false);
      setToast('Appointment booked successfully');
    }} />}{selected && (() => {
      const current = state.appointments.find(a => a.id === selected.id)!;
      const p = state.patients.find(p => p.id === current.patientId)!;
      return <Modal title="Appointment details" description={current.id} onClose={() => setSelected(null)}><div className="modal-body"><div className="person-cell"><Avatar person={p} size="lg" /><span><h3>{p.name}</h3><small>{p.id} · {p.age} years · {p.gender}</small></span></div><div className="detail-grid"><div><span>Date</span><strong>{dateLabel(current.date)}</strong></div><div><span>Time</span><strong>{current.time} · 30 minutes</strong></div><div><span>Visit type</span><strong>{current.type}</strong></div><div><span>Status</span><Badge>{current.status}</Badge></div><div className="full"><span>Reason for visit</span><strong>{current.reason}</strong></div></div></div><div className="modal-actions">{!['Completed', 'Cancelled'].includes(current.status) && <button className="button danger" onClick={() => {
            updateAppointment(current.id, 'Cancelled');
            setToast('Appointment cancelled');
            setSelected(null);
          }}>Cancel appointment</button>}<Link className="button primary" href={`/session?patient=${p.id}&appointment=${current.id}`}>Open patient session <ArrowRightIcon /></Link></div></Modal>;
    })()}{toast && <Toast message={toast} onClose={() => setToast('')} />}</>;
}
function ArrowRightIcon() {
  return <ArrowUpRight size={16} />;
}

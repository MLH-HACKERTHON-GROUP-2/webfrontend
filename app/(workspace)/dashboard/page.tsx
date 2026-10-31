'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, CalendarDays, Users, Clock3, CheckCheck, ArrowRight, ChevronLeft, ChevronRight, ArrowUpRight, Pill, Stethoscope, FolderHeart, Sun, HeartPulse } from 'lucide-react';
import { useStore } from '@/lib/store';
import { TODAY, type Appointment } from '@/lib/data';
import { PageHeading, Stat, Panel, Avatar, Badge, Toast, Empty } from '@/components/ui';
import { AppointmentForm } from '@/components/appointment-form';
export default function Dashboard() {
  const {
    state
  } = useStore();
  const [booking, setBooking] = useState(false);
  const [toast, setToast] = useState('');
  const [period, setPeriod] = useState('week');
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState(31);
  const today = state.appointments.filter(a => a.date === TODAY);
  const upcoming = today.filter(a => !['Completed', 'Cancelled'].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time));
  const all = state.appointments;
  const active = all.filter(a => !['Cancelled', 'Completed'].includes(a.status));
  const completed = all.filter(a => a.status === 'Completed');
  const low = state.medicines.filter(m => m.stock <= m.threshold);
  const chartDates = Array.from({
    length: period === 'week' ? 7 : 14
  }, (_, i) => {
    const d = new Date('2026-10-31T12:00:00');
    d.setDate(d.getDate() - (period === 'week' ? 6 : 13) + i);
    return d.toISOString().slice(0, 10);
  });
  const chartMax = Math.ceil(Math.max(4, ...chartDates.map(d => all.filter(a => a.date === d).length)) / 4) * 4;
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const selectedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const selected = all.filter(a => a.date === selectedDate);
  function moveMonth(offset: number) {
    const d = new Date(year, month + offset, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setSelectedDay(1);
  }
  return <><PageHeading eyebrow="YOUR PRACTICE AT A GLANCE" title={`Good morning, ${state.profile.name.replace('Dr. ', '').split(' ')[0]} 👋`} description="Here’s what’s happening at your practice today." actions={<><span className="date-control"><CalendarDays size={16} /> Sat, 31 Oct 2026</span><button className="button primary" onClick={() => setBooking(true)}><Plus size={17} /> New appointment</button></>} /><div className="welcome-banner"><div className="banner-icon"><Sun size={30} /></div><div><strong>A good day to make a difference.</strong><p>You have <b>{upcoming.length} appointments</b> on your schedule today. Let’s give your patients the care they deserve.</p></div><Link href="/appointments">View schedule <ArrowRight size={16} /></Link><div className="banner-decoration"><HeartPulse size={115} strokeWidth={.8} /></div></div><div className="stats-grid"><Stat label="Total patients" value={state.patients.length} detail="Registered in your practice" icon={<Users size={19} />} accent /><Stat label="Today’s appointments" value={today.length} detail={`${upcoming.length} upcoming today`} icon={<CalendarDays size={19} />} /><Stat label="Completed visits" value={completed.length} detail="Across all appointments" icon={<CheckCheck size={19} />} /><Stat label="Pending prescriptions" value={state.prescriptions.filter(r => r.status === 'Pending').length} detail="Awaiting pharmacy dispensing" icon={<Pill size={19} />} /></div><div className="dashboard-main"><div className="dashboard-left"><Panel title="Appointment activity" subtitle="A little insight into your practice’s rhythm" action={<select aria-label="Chart period" className="compact-select" value={period} onChange={e => setPeriod(e.target.value)}><option value="week">Last 7 days</option><option value="fortnight">Last 14 days</option></select>}><div className="chart-legend"><span><i className="dot emerald" /> All appointments</span><span><i className="dot pale" /> Completed</span></div><div className="bar-chart"><div className="chart-axis">{[chartMax, Math.round(chartMax * .75), Math.round(chartMax * .5), Math.round(chartMax * .25), 0].map((n, i) => <span key={i}>{n}</span>)}</div><div className="chart-plot"><div className="chart-grid">{[0, 1, 2, 3, 4].map(n => <i key={n} />)}</div>{chartDates.map(d => {
                const total = all.filter(a => a.date === d).length;
                const done = all.filter(a => a.date === d && a.status === 'Completed').length;
                return <div className="chart-column" key={d}><div className="bar-pair" title={`${d}: ${total} appointments, ${done} completed`}><div className="bar total" style={{
                      height: `${total / chartMax * 100}%`
                    }} /><div className="bar complete" style={{
                      height: `${done / chartMax * 100}%`
                    }} /></div><span>{new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', period === 'week' ? {
                      weekday: 'short'
                    } : {
                      day: 'numeric'
                    })}</span></div>;
              })}</div></div><div className="chart-footer"><span><span className="dot emerald" /> {all.length} appointments in your practice</span><Link href="/reports">View full report <ArrowUpRight size={15} /></Link></div></Panel><Panel title="Today’s appointments" subtitle={`${today.length} patients on your schedule`} action={<Link className="text-link" href="/appointments">View all <ArrowRight size={15} /></Link>} className="appointments-panel"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Time</th><th>Visit type</th><th>Status</th><th /></tr></thead><tbody>{today.slice(0, 5).map(a => {
                  const p = state.patients.find(p => p.id === a.patientId)!;
                  return <tr key={a.id}><td><div className="person-cell"><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{p.id}</small></span></div></td><td className="nowrap"><Clock3 size={13} className="inline-icon" />{a.time}</td><td>{a.type}</td><td><Badge>{a.status}</Badge></td><td><Link className="table-action" href={`/session?patient=${p.id}&appointment=${a.id}`} aria-label={`Open session for ${p.name}`}><ArrowUpRight size={17} /></Link></td></tr>;
                })}</tbody></table></div></Panel></div><div className="dashboard-right"><Panel title="Your calendar" className="calendar-panel"><div className="calendar-month"><strong>{new Date(year, month, 1).toLocaleDateString('en-ZA', {
                month: 'long',
                year: 'numeric'
              })}</strong><div><button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button><button aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={16} /></button></div></div><div className="mini-calendar">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span className="day-name" key={i}>{d}</span>)}{Array.from({
              length: first
            }, (_, i) => <span key={`blank${i}`} />)}{Array.from({
              length: days
            }, (_, i) => <button key={i} className={`${selectedDay === i + 1 ? 'selected' : ''} ${all.some(a => a.date === `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`) ? 'has-event' : ''}`} onClick={() => setSelectedDay(i + 1)}>{i + 1}</button>)}</div><div className="calendar-key"><i />Scheduled appointments</div></Panel><Panel title={selectedDate === TODAY ? 'Up next today' : `${selectedDay} ${new Date(year, month, 1).toLocaleDateString('en-ZA', {
          month: 'short'
        })} appointments`} action={<span className="count-chip">{selected.filter(a => !['Completed', 'Cancelled'].includes(a.status)).length}</span>} className="up-next-panel">{selected.filter(a => !['Completed', 'Cancelled'].includes(a.status)).slice(0, 2).map((a, i) => {
            const p = state.patients.find(p => p.id === a.patientId)!;
            return <div className={`up-next-card ${i === 0 ? 'first' : ''}`} key={a.id}><div className="up-next-top"><span><Clock3 size={14} />{a.time} – {String(Number(a.time.slice(0, 2)) + (a.time.endsWith('30') ? 1 : 0)).padStart(2, '0')}:{a.time.endsWith('30') ? '00' : '30'}</span><Badge>{a.type}</Badge></div><div className="person-cell"><Avatar person={p} /><span><strong>{p.name}</strong><small>{p.age} years · {p.gender}</small></span></div><p>{a.reason}</p><Link href={`/session?patient=${p.id}&appointment=${a.id}`} className={`button ${i === 0 ? 'primary' : 'subtle'}`}>Start consultation <ArrowRight size={15} /></Link></div>;
          })}{!selected.some(a => !['Completed', 'Cancelled'].includes(a.status)) && <Empty title="Your schedule is clear" text="No upcoming visits on this date." />}</Panel></div></div><div className="dashboard-bottom"><Panel title="Quick access" subtitle="Your everyday essentials, one click away"><div className="quick-links">{[{
            href: '/session',
            icon: Stethoscope,
            label: 'Start consultation',
            desc: 'Give your next patient your best'
          }, {
            href: '/records',
            icon: FolderHeart,
            label: 'Patient records',
            desc: 'The full picture of their health'
          }, {
            href: '/pharmacy',
            icon: Pill,
            label: 'Manage pharmacy',
            desc: 'Keep care moving forward'
          }].map(({
            href,
            icon: Icon,
            label,
            desc
          }) => <Link href={href} key={href}><span className="quick-icon"><Icon size={21} /></span><span><strong>{label}</strong><small>{desc}</small></span><ArrowUpRight size={18} /></Link>)}</div></Panel><div className="inventory-notice"><span className="notice-icon"><Pill size={24} /></span><div><strong>A little inventory check?</strong><p>{low.length} medicines are running low on stock.</p><Link href="/pharmacy?filter=low">Review inventory <ArrowRight size={14} /></Link></div></div></div>{booking && <AppointmentForm onClose={() => setBooking(false)} onSaved={() => {
      setBooking(false);
      setToast('Appointment booked successfully');
    }} />}{toast && <Toast message={toast} onClose={() => setToast('')} />}</>;
}

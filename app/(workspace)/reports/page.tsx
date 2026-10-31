'use client';

import { useState } from 'react';
import { Download, CalendarDays, Users, Package, TrendingUp, ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, CheckCircle2, Filter } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dateLabel, TODAY } from '@/lib/data';
import { PageHeading, Panel, Stat, Badge, Avatar, Empty, downloadCSV } from '@/components/ui';
export default function Reports() {
  const {
    state
  } = useStore();
  const [tab, setTab] = useState('Medicine movement');
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState(TODAY);
  const [caseFilter, setCase] = useState('All cases');
  const [movementType, setMovementType] = useState('All movements');
  const [status, setStatus] = useState('All statuses');
  const inRange = (d: string) => d >= from && d <= to;
  const movements = state.movements.filter(m => inRange(m.date) && (movementType === 'All movements' || m.type === movementType)).sort((a, b) => b.date.localeCompare(a.date));
  const visits = state.appointments.filter(a => inRange(a.date) && (status === 'All statuses' || a.status === status));
  const patients = state.patients.filter(p => (caseFilter === 'All cases' || p.case === caseFilter) && state.appointments.some(a => a.patientId === p.id && inRange(a.date)));
  const cases = Array.from(new Set(state.patients.map(p => p.case)));
  const received = movements.filter(m => m.type === 'Stock received').reduce((s, m) => s + m.quantity, 0);
  const dispensed = movements.filter(m => m.type === 'Dispensed').reduce((s, m) => s + m.quantity, 0);
  const completed = visits.filter(a => a.status === 'Completed').length;
  function exportData() {
    if (tab === 'Medicine movement') downloadCSV('emerald-medicine-movement.csv', ['Date', 'Medicine', 'Movement', 'Quantity', 'Reference'], movements.map(m => [m.date, state.medicines.find(x => x.id === m.medicineId)!.name, m.type, m.quantity, m.reference]));else if (tab === 'Patient analysis') downloadCSV('emerald-patient-analysis.csv', ['Patient ID', 'Name', 'Age', 'Gender', 'Case', 'Visits in period'], patients.map(p => [p.id, p.name, p.age, p.gender, p.case, state.appointments.filter(a => a.patientId === p.id && inRange(a.date)).length]));else downloadCSV('emerald-appointment-report.csv', ['Date', 'Time', 'Patient', 'Type', 'Status'], visits.map(a => [a.date, a.time, state.patients.find(p => p.id === a.patientId)!.name, a.type, a.status]));
  }
  return <><PageHeading eyebrow="A CLEARER PICTURE OF YOUR PRACTICE" title="Reports & analytics" description="Turn everyday activity into thoughtful decisions." actions={<button className="button primary" onClick={exportData}><Download size={16} /> Export report</button>} /><div className="report-filter-bar"><span><CalendarDays size={18} /> Reporting period</span><div><label>From<input aria-label="Report start date" type="date" value={from} max={to} onChange={e => {
            if (e.target.value) setFrom(e.target.value);
          }} /></label><span className="muted">→</span><label>To<input aria-label="Report end date" type="date" value={to} min={from} onChange={e => {
            if (e.target.value) setTo(e.target.value);
          }} /></label></div><span className="report-period-label">{dateLabel(from)} – {dateLabel(to)}</span></div><div className="tabs report-tabs">{[{
        name: 'Medicine movement',
        icon: Package
      }, {
        name: 'Patient analysis',
        icon: Users
      }, {
        name: 'Appointments',
        icon: CalendarDays
      }].map(({
        name,
        icon: Icon
      }) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon size={17} />{name}</button>)}</div>{tab === 'Medicine movement' ? <><div className="stats-grid"><Stat label="Units received" value={received.toLocaleString()} detail="Stock added in this period" icon={<ArrowDownLeft size={19} />} accent /><Stat label="Units dispensed" value={dispensed.toLocaleString()} detail="Medicine served to patients" icon={<ArrowUpRight size={19} />} /><Stat label="Net movement" value={(received - dispensed).toLocaleString()} detail="Received minus dispensed" icon={<TrendingUp size={19} />} /><Stat label="Movement entries" value={movements.length} detail="Filtered stock transactions" icon={<Package size={19} />} /></div><Panel title="Medicine movement" subtitle="Every unit, accounted for" action={<select aria-label="Movement type" value={movementType} onChange={e => setMovementType(e.target.value)}>{['All movements', 'Stock received', 'Dispensed'].map(t => <option key={t}>{t}</option>)}</select>}><div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Date</th><th>Movement</th><th>Quantity</th><th>Reference</th></tr></thead><tbody>{movements.map(m => {
                const med = state.medicines.find(x => x.id === m.medicineId)!;
                return <tr key={m.id}><td><div className="person-cell"><span className="record-icon"><Package size={18} /></span><span><strong>{med.name}</strong><small>{med.strength}</small></span></div></td><td>{dateLabel(m.date)}</td><td><Badge>{m.type}</Badge></td><td><strong className={m.type === 'Dispensed' ? 'warning-text' : 'emerald-text'}>{m.type === 'Dispensed' ? '−' : '+'}{m.quantity}</strong> units</td><td className="muted">{m.reference}</td></tr>;
              })}</tbody></table>{!movements.length && <Empty title="No movements in this period" text="Choose another period or movement type." />}</div><div className="table-footer">{movements.length} stock transactions<span>Dispensing and receiving stock create these entries automatically.</span></div></Panel></> : tab === 'Patient analysis' ? <><div className="stats-grid"><Stat label="Patients seen / booked" value={patients.length} detail="Patients with visits in the period" icon={<Users size={19} />} accent /><Stat label="Average age" value={patients.length ? Math.round(patients.reduce((s, p) => s + p.age, 0) / patients.length) : '—'} detail="Across the filtered patients" icon={<ChartNoAxesCombined size={19} />} /><Stat label="Female patients" value={patients.filter(p => p.gender === 'Female').length} detail="Within the selected cohort" icon={<Users size={19} />} /><Stat label="Male patients" value={patients.filter(p => p.gender === 'Male').length} detail="Within the selected cohort" icon={<Users size={19} />} /></div><div className="analysis-grid"><Panel title="Patients by case" subtitle="Distribution within the selected period" action={<select aria-label="Filter patients by case" value={caseFilter} onChange={e => setCase(e.target.value)}><option>All cases</option>{cases.map(c => <option key={c}>{c}</option>)}</select>}><div className="case-chart">{cases.filter(c => caseFilter === 'All cases' || c === caseFilter).map((c, i) => {
              const count = patients.filter(p => p.case === c).length;
              return <div className="case-chart-row" key={c}><span>{c}</span><div><span className={`case-bar case-${i}`} style={{
                    width: `${patients.length ? count / patients.length * 100 : 0}%`
                  }} /></div><strong>{count}</strong><small>{patients.length ? Math.round(count / patients.length * 100) : 0}%</small></div>;
            })}{!patients.length && <Empty />}</div></Panel><Panel title="Age distribution" subtitle="Getting to know your patient community"><div className="age-chart">{[[0, 29], [30, 44], [45, 59], [60, 120]].map(([min, max]) => {
              const count = patients.filter(p => p.age >= min && p.age <= max).length;
              return <div key={min}><strong>{count}</strong><div className="age-bar-track"><span style={{
                    height: `${patients.length ? Math.max(0, count / patients.length * 100) : 0}%`
                  }} /></div><span>{min === 60 ? '60+' : `${min}–${max}`}</span></div>;
            })}</div></Panel></div><Panel title="Patient analysis" subtitle="Filtered by case and appointment date"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Age</th><th>Gender</th><th>Primary case</th><th>Visits in period</th></tr></thead><tbody>{patients.map(p => <tr key={p.id}><td><div className="person-cell"><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{p.id}</small></span></div></td><td>{p.age} years</td><td>{p.gender}</td><td><span className="case-tag">{p.case}</span></td><td>{state.appointments.filter(a => a.patientId === p.id && inRange(a.date)).length}</td></tr>)}</tbody></table>{!patients.length && <Empty />}</div></Panel></> : <><div className="stats-grid"><Stat label="Total appointments" value={visits.length} detail="Within your selected filters" icon={<CalendarDays size={19} />} accent /><Stat label="Completed" value={completed} detail="Completed patient visits" icon={<CheckCircle2 size={19} />} /><Stat label="Completion rate" value={visits.length ? `${Math.round(completed / visits.length * 100)}%` : '—'} detail="Completed ÷ filtered appointments" icon={<TrendingUp size={19} />} /><Stat label="Cancelled" value={visits.filter(a => a.status === 'Cancelled').length} detail="Cancelled in this period" icon={<CalendarDays size={19} />} /></div><Panel title="Appointment report" subtitle="Understand the flow of care in your practice" action={<select aria-label="Report appointment status" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses', 'Confirmed', 'Waiting', 'In progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}</select>}><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Visit type</th><th>Status</th></tr></thead><tbody>{visits.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).map(a => {
                const p = state.patients.find(p => p.id === a.patientId)!;
                return <tr key={a.id}><td><div className="person-cell"><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{a.id}</small></span></div></td><td>{dateLabel(a.date)}</td><td>{a.time}</td><td>{a.type}</td><td><Badge>{a.status}</Badge></td></tr>;
              })}</tbody></table>{!visits.length && <Empty title="No appointments in this period" />}</div><div className="table-footer">Showing {visits.length} appointments<span>All times in South Africa Standard Time (UTC+2)</span></div></Panel></>}<p className="report-caption"><Filter size={14} /> Reports reflect synthetic demo data and your changes in this browser. Exports respect the current filters.</p></>;
}

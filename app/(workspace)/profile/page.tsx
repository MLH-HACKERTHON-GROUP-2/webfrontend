'use client';

import { useState, type FormEvent } from 'react';
import { Save, Mail, Phone, MapPin, ShieldCheck, Stethoscope, GraduationCap, CalendarDays, Check, Clock3 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DEMO_EMAIL } from '@/lib/data';
import { PageHeading, Panel, Avatar, FormField, Toast } from '@/components/ui';
export default function Profile() {
  const {
    state,
    saveProfile
  } = useStore();
  const [days, setDays] = useState(state.profile.available);
  const [toast, setToast] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    saveProfile({
      name: String(f.get('name')).trim(),
      email: DEMO_EMAIL,
      phone: String(f.get('phone')).trim(),
      specialty: String(f.get('specialty')).trim(),
      bio: String(f.get('bio')).trim(),
      available: days
    });
    setToast('Profile and availability updated');
  }
  return <><PageHeading eyebrow="THE HEART OF YOUR PRACTICE" title="Doctor profile" description="A little about you. A lot about the care you give." /><form onSubmit={submit} className="profile-layout"><div className="profile-card panel"><div className="profile-cover"><span>+</span><span>+</span><span>+</span></div><div className="profile-card-body"><Avatar person={{
            name: state.profile.name,
            color: 'mint'
          }} size="lg" /><span className="verified-tag"><ShieldCheck size={14} /> Demo clinician</span><h2>{state.profile.name}</h2><p>{state.profile.specialty}</p><span className="profile-location"><MapPin size={14} /> Johannesburg, South Africa</span><div className="profile-numbers"><div><strong>{state.patients.length}</strong><span>Patients</span></div><div><strong>{state.appointments.filter(a => a.status === 'Completed').length}</strong><span>Completed visits</span></div></div><div className="profile-contact"><span><Mail size={16} />{state.profile.email}</span><span><Phone size={16} />{state.profile.phone}</span><span><Stethoscope size={16} />Emerald Medical Centre</span></div></div><div className="profile-note"><ShieldCheck size={18} /><p>Profile changes are saved in this browser’s demo workspace.</p></div></div><div><Panel title="Personal information" subtitle="Help your team and patients get to know you"><div className="form-grid panel-body"><FormField label="Full name" wide><input name="name" defaultValue={state.profile.name} required maxLength={100} /></FormField><FormField label="Email address"><input type="email" value={DEMO_EMAIL} readOnly aria-describedby="email-hint" /><small id="email-hint">The demo sign-in email is fixed.</small></FormField><FormField label="Phone number"><input type="tel" name="phone" defaultValue={state.profile.phone} required maxLength={40} /></FormField><FormField label="Specialty" wide><input name="specialty" defaultValue={state.profile.specialty} required maxLength={100} /></FormField><FormField label="About you" wide><textarea name="bio" defaultValue={state.profile.bio} rows={4} required maxLength={1500} /></FormField></div></Panel><Panel title="Practice information" subtitle="Where your care comes together"><div className="detail-grid panel-body"><div><span>Medical centre</span><strong>Emerald Medical Centre</strong></div><div><span>Department</span><strong>General Medicine</strong></div><div><span>Location</span><strong>Johannesburg, South Africa</strong></div><div><span>Consultation duration</span><strong>30 minutes</strong></div></div></Panel><Panel title="Weekly availability" subtitle="Set the days you’re available for patient care" action={<CalendarDays size={20} className="muted" />}><div className="panel-body"><div className="availability-days">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <button key={d} type="button" aria-pressed={days.includes(d)} className={days.includes(d) ? 'selected' : ''} onClick={() => setDays(current => current.includes(d) ? current.filter(x => x !== d) : [...current, d])}><span>{d}</span>{days.includes(d) ? <Check size={17} /> : <span className="day-unselected" />}</button>)}</div><p className="availability-caption"><Clock3 size={15} /> Demo practice hours: 08:00 – 17:00 (SAST)</p></div></Panel><div className="profile-save"><span>Changes apply to this demo workspace.</span><button className="button primary"><Save size={16} /> Save changes</button></div></div></form>{toast && <Toast message={toast} onClose={() => setToast('')} />}</>;
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutDashboard, CalendarDays, Stethoscope, FolderHeart, UserRound, Pill, ChartNoAxesCombined, Search, Bell, ChevronDown, ChevronsUpDown, LogOut, Menu, X, ArrowUpRight, ShieldCheck, Building2, Check, Command, QrCode } from 'lucide-react';
import { pairingKeyFor } from '@/lib/backend/config';
import { useStore, roleHome, canVisit } from '@/lib/store';
import { Brand, Avatar, Modal } from './ui';
const nav = [{
  href: '/dashboard',
  label: 'Overview',
  icon: LayoutDashboard
}, {
  href: '/appointments',
  label: 'Appointments',
  icon: CalendarDays
}, {
  href: '/session',
  label: 'Patient session',
  icon: Stethoscope
}, {
  href: '/records',
  label: 'Medical records',
  icon: FolderHeart
}, {
  href: '/pharmacy',
  label: 'Pharmacy',
  icon: Pill
}, {
  href: '/reports',
  label: 'Reports & analytics',
  icon: ChartNoAxesCombined
}, {
  href: '/connections',
  label: 'QR & patient connections',
  icon: QrCode
}];
export default function Shell({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const router = useRouter();
  const { state, ready, storageError, user, signOut, busy, error, live, run, reload, mode } = useStore();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [clinic, setClinic] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!user) { const pair = new URLSearchParams(window.location.hash.slice(1)).get('pair'); if (pair) sessionStorage.setItem(pairingKeyFor(mode), pair); router.replace('/login'); }
    else if (!canVisit(user.role, pathname)) router.replace(roleHome(user.role));
  }, [ready, user, pathname, router, mode]);
  useEffect(() => {
    setMobile(false);
    setSearch('');
  }, [pathname]);
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.global-search input')?.focus();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const lowStock = state.medicines.filter(m => m.stock <= m.threshold);
  const pending = state.prescriptions.filter(r => r.status === 'Pending');
  if (!ready || !user || !canVisit(user.role, pathname)) return <div className="app-loading"><Brand /><span className="loading-line" /><p>Preparing your workspace…</p></div>;
  const items = user.role === 'PATIENT' ? [{ href: '/portal', label: 'My care', icon: FolderHeart }, { href: '/appointments', label: 'My appointments', icon: CalendarDays }, { href: '/records', label: 'Medical records', icon: FolderHeart }] : user.role === 'SYSTEM_ADMIN' || user.role === 'HOSPITAL_ADMIN' ? [{ href: '/administration', label: 'Administration', icon: Building2 }, ...nav.filter(n => canVisit(user.role, n.href))] : nav.filter(n => canVisit(user.role, n.href));
  return <div className="app"><button className={`sidebar-scrim ${mobile ? 'show' : ''}`} aria-label="Close navigation" onClick={() => setMobile(false)} /><aside className={`sidebar ${mobile ? 'open' : ''}`}><Link href={roleHome(user.role)} className="brand-link"><Brand /></Link><button className="clinic-switch" onClick={() => setClinic(true)}><span className="clinic-symbol"><Building2 size={21} /></span><span><strong>{state.hospitalName || 'Emerald Care'}</strong><small>Johannesburg, South Africa</small></span><ChevronsUpDown size={14} /></button><p className="nav-label">WORKSPACE</p><nav>{items.map(({
          href,
          label,
          icon: Icon
        }) => <Link className={`nav-item ${pathname === href ? 'active' : ''}`} key={href} href={href}><Icon size={19} /><span>{label}</span>{href === '/appointments' && <span className="nav-count">{state.appointments.filter(a => a.date === '2026-10-31' && !['Completed', 'Cancelled'].includes(a.status)).length}</span>}{pathname === href && <span className="active-dot" />}</Link>)}</nav><p className="nav-label second">ACCOUNT</p><Link className={`nav-item ${pathname === '/profile' ? 'active' : ''}`} href={user.role === 'DOCTOR' ? '/profile' : roleHome(user.role)}><UserRound size={19} /><span>{user.role === 'DOCTOR' ? 'Doctor profile' : 'My workspace'}</span></Link><div className="sidebar-bottom"><div className="care-card"><span className="care-card-icon"><ShieldCheck size={23} /></span><h3>Better care, together.</h3><p>Your patients. Your practice.<br />One connected workspace.</p><Link href={roleHome(user.role)}>Your workspace <ArrowUpRight size={15} /></Link></div><div className="sidebar-user"><Avatar person={{
            name: state.profile.name,
            color: 'mint'
          }} size="sm" /><span><strong>{state.profile.name}</strong><small>{state.profile.specialty}</small></span><button aria-label="Sign out" onClick={() => {
            signOut();
            router.push('/login');
          }}><LogOut size={17} /></button></div></div></aside><div className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={21} /></button><div className="global-search"><Search size={18} /><input aria-label="Search patients" placeholder="Search patients, records and more…" value={search} onChange={e => setSearch(e.target.value)} /><kbd><Command size={12} /> K</kbd>{search && <div className="search-results"><p>Patients</p>{state.patients.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(search.toLowerCase())).slice(0, 5).map(p => <Link key={p.id} onClick={() => setSearch('')} href={`/records?patient=${p.id}`}><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{p.id} · {p.case}</small></span><ArrowUpRight size={16} /></Link>)}{!state.patients.some(p => (p.name + ' ' + p.id).toLowerCase().includes(search.toLowerCase())) && <span className="search-empty">No matching patients</span>}</div>}</div></div><div className="topbar-right"><span className="demo-pill"><i />{mode === 'live' ? 'Live backend' : 'Simulation'}</span><span className="top-divider" /><Link className="icon-button" aria-label="Open workspace" href={user.role === 'DOCTOR' ? '/appointments' : roleHome(user.role)}><CalendarDays size={19} /></Link><div className="popover-anchor"><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotifications(!notifications)}><Bell size={19} /><i /></button>{notifications && <div className="notification-popover"><h3>Workspace updates</h3><Link href="/pharmacy" onClick={() => setNotifications(false)}><Pill size={19} /><span><strong>{lowStock.length} medicines need restocking</strong><small>Review low-stock items in your catalog</small></span></Link><Link href="/pharmacy" onClick={() => setNotifications(false)}><Stethoscope size={19} /><span><strong>{pending.length} prescriptions pending</strong><small>Ready for the pharmacy team</small></span></Link><p><Check size={13} /> {mode === 'live' ? 'Information from the connected backend' : 'All information is synthetic demo data'}</p></div>}</div><div className="popover-anchor"><button className="header-user" onClick={() => setProfileMenu(!profileMenu)} aria-label="Account menu"><Avatar person={{
                name: state.profile.name,
                color: 'mint'
              }} size="sm" /><ChevronDown size={14} /></button>{profileMenu && <div className="account-popover"><Link href={user.role === 'DOCTOR' ? '/profile' : roleHome(user.role)}><UserRound size={16} /> My workspace</Link><button onClick={() => {
                signOut();
                router.push('/login');
              }}><LogOut size={16} /> Sign out</button></div>}</div></div></header>{storageError && <div className="storage-warning" role="alert">Browser session storage is unavailable. Keep this tab open while you work.</div>}<main className="page-content">{error && <div className="simulation-error" role="alert"><p>{error}</p><button className="button small" disabled={busy} onClick={() => run(reload)}>Retry connection</button></div>}{children}</main><footer className="app-footer"><span>© 2026 Emerald Care</span><span><ShieldCheck size={13} /> {mode === 'live' ? 'Live backend · remote records' : 'Simulation · synthetic patient data'}</span><span className="footer-status"><i /> {live}</span></footer></div>{clinic && <Modal title="Your medical centre" description="Your connected care workspace." onClose={() => setClinic(false)}><div className="clinic-details"><Building2 size={34} /><h3>{state.hospitalName || 'Emerald Care'}</h3><p>Johannesburg, South Africa</p><p>General practice · Clinical & pharmacy workspace</p><BadgeLocal /></div><div className="modal-actions"><button className="button primary" onClick={() => setClinic(false)}>Continue to workspace</button></div></Modal>}</div>;
}
function BadgeLocal() {
  return <span className="demo-pill"><i />Connected practice</span>;
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutDashboard, CalendarDays, Stethoscope, FolderHeart, UserRound, Pill, ChartNoAxesCombined, Search, Bell, ChevronDown, ChevronsUpDown, LogOut, Menu, X, ArrowUpRight, ShieldCheck, Building2, Check, Command } from 'lucide-react';
import { useStore } from '@/lib/store';
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
}];
export default function Shell({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const router = useRouter();
  const {
    state,
    ready,
    storageError
  } = useStore();
  const [authenticated, setAuthenticated] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [clinic, setClinic] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem('emerald-session') === 'demo') setAuthenticated(true);else router.replace('/login');
  }, [router]);
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
  if (!ready || !authenticated) return <div className="app-loading"><Brand /><span className="loading-line" /><p>Preparing your workspace…</p></div>;
  return <div className="app"><button className={`sidebar-scrim ${mobile ? 'show' : ''}`} aria-label="Close navigation" onClick={() => setMobile(false)} /><aside className={`sidebar ${mobile ? 'open' : ''}`}><Link href="/dashboard" className="brand-link"><Brand /></Link><button className="clinic-switch" onClick={() => setClinic(true)}><span className="clinic-symbol"><Building2 size={21} /></span><span><strong>Emerald Medical Centre</strong><small>Johannesburg, South Africa</small></span><ChevronsUpDown size={14} /></button><p className="nav-label">WORKSPACE</p><nav>{nav.map(({
          href,
          label,
          icon: Icon
        }) => <Link className={`nav-item ${pathname === href ? 'active' : ''}`} key={href} href={href}><Icon size={19} /><span>{label}</span>{href === '/appointments' && <span className="nav-count">{state.appointments.filter(a => a.date === '2026-10-31' && !['Completed', 'Cancelled'].includes(a.status)).length}</span>}{pathname === href && <span className="active-dot" />}</Link>)}</nav><p className="nav-label second">ACCOUNT</p><Link className={`nav-item ${pathname === '/profile' ? 'active' : ''}`} href="/profile"><UserRound size={19} /><span>Doctor profile</span></Link><div className="sidebar-bottom"><div className="care-card"><span className="care-card-icon"><ShieldCheck size={23} /></span><h3>Better care, together.</h3><p>Your patients. Your practice.<br />One connected workspace.</p><Link href="/profile">View your profile <ArrowUpRight size={15} /></Link></div><div className="sidebar-user"><Avatar person={{
            name: state.profile.name,
            color: 'mint'
          }} size="sm" /><span><strong>{state.profile.name}</strong><small>{state.profile.specialty}</small></span><button aria-label="Sign out" onClick={() => {
            sessionStorage.removeItem('emerald-session');
            router.push('/login');
          }}><LogOut size={17} /></button></div></div></aside><div className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={21} /></button><div className="global-search"><Search size={18} /><input aria-label="Search patients" placeholder="Search patients, records and more…" value={search} onChange={e => setSearch(e.target.value)} /><kbd><Command size={12} /> K</kbd>{search && <div className="search-results"><p>Patients</p>{state.patients.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(search.toLowerCase())).slice(0, 5).map(p => <Link key={p.id} onClick={() => setSearch('')} href={`/records?patient=${p.id}`}><Avatar person={p} size="sm" /><span><strong>{p.name}</strong><small>{p.id} · {p.case}</small></span><ArrowUpRight size={16} /></Link>)}{!state.patients.some(p => (p.name + ' ' + p.id).toLowerCase().includes(search.toLowerCase())) && <span className="search-empty">No matching patients</span>}</div>}</div></div><div className="topbar-right"><span className="demo-pill"><i />Demo workspace</span><span className="top-divider" /><Link className="icon-button" aria-label="Open calendar" href="/appointments"><CalendarDays size={19} /></Link><div className="popover-anchor"><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotifications(!notifications)}><Bell size={19} /><i /></button>{notifications && <div className="notification-popover"><h3>Workspace updates</h3><Link href="/pharmacy" onClick={() => setNotifications(false)}><Pill size={19} /><span><strong>{lowStock.length} medicines need restocking</strong><small>Review low-stock items in your catalog</small></span></Link><Link href="/pharmacy" onClick={() => setNotifications(false)}><Stethoscope size={19} /><span><strong>{pending.length} prescriptions pending</strong><small>Ready for the pharmacy team</small></span></Link><p><Check size={13} /> All information is synthetic demo data</p></div>}</div><div className="popover-anchor"><button className="header-user" onClick={() => setProfileMenu(!profileMenu)} aria-label="Account menu"><Avatar person={{
                name: state.profile.name,
                color: 'mint'
              }} size="sm" /><ChevronDown size={14} /></button>{profileMenu && <div className="account-popover"><Link href="/profile"><UserRound size={16} /> My profile</Link><button onClick={() => {
                sessionStorage.removeItem('emerald-session');
                router.push('/login');
              }}><LogOut size={16} /> Sign out</button></div>}</div></div></header>{storageError && <div className="storage-warning" role="alert">Browser storage is unavailable or saved data could not be read. Changes may only last for this session.</div>}<main className="page-content">{children}</main><footer className="app-footer"><span>© 2026 Emerald Care</span><span><ShieldCheck size={13} /> Demo workspace · Synthetic patient data</span><span className="footer-status"><i /> Workspace ready</span></footer></div>{clinic && <Modal title="Your medical centre" description="You are working in this demo practice." onClose={() => setClinic(false)}><div className="clinic-details"><Building2 size={34} /><h3>Emerald Medical Centre</h3><p>Johannesburg, South Africa</p><p>General practice · Clinical & pharmacy workspace</p><BadgeLocal /></div><div className="modal-actions"><button className="button primary" onClick={() => setClinic(false)}>Continue to workspace</button></div></Modal>}</div>;
}
function BadgeLocal() {
  return <span className="demo-pill"><i />Demo practice</span>;
}

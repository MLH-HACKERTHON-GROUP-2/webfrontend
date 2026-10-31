'use client';

import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X, Plus, ArrowUpRight, Activity } from 'lucide-react';
import { initials, type Patient } from '@/lib/data';
export function Brand({
  light = false
}: {
  light?: boolean;
}) {
  return <div className={`brand ${light ? 'light' : ''}`}><span className="brand-icon"><Plus size={25} strokeWidth={3} /></span><span>emerald<span className="brand-care">care</span><small>CONNECTED CARE, SIMPLIFIED</small></span></div>;
}
export function Avatar({
  person,
  size = 'md'
}: {
  person: Pick<Patient, 'name' | 'color'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  return <span className={`avatar ${person.color} ${size}`}>{initials(person.name)}</span>;
}
export function Badge({
  children
}: {
  children: ReactNode;
}) {
  return <span className={`badge ${String(children).toLowerCase().replaceAll(' ', '-')}`}><i />{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{actions}</div></div>;
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = ''
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{title && <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>;
}
export function Stat({
  label,
  value,
  detail,
  icon,
  accent = false
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return <div className={`stat-card ${accent ? 'accent' : ''}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}<svg viewBox="0 0 100 35" className="sparkline" aria-hidden="true"><path d="M2 30 L12 23 L22 26 L32 14 L42 20 L52 10 L62 15 L72 7 L82 12 L98 2" /></svg></div><div className="stat-detail"><ArrowUpRight size={14} />{detail}</div></div>;
}
export function Empty({
  title = 'No results found',
  text = 'Try adjusting your search or filters.'
}: {
  title?: string;
  text?: string;
}) {
  return <div className="empty"><Activity size={28} /><h3>{title}</h3><p>{text}</p></div>;
}
let modalCount = 0;
let originalBodyOverflow = '';
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    if (modalCount === 0) originalBodyOverflow = document.body.style.overflow;
    modalCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      modalCount -= 1;
      if (modalCount === 0) document.body.style.overflow = originalBodyOverflow;
      el?.close();
    };
  }, []);
  return <dialog ref={dialog} aria-label={title} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => {
    if (e.target === e.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    }
  }}><div className="modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}
export function FormField({
  label,
  children,
  wide = false
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return <label className={`field ${wide ? 'full' : ''}`}><span>{label}</span>{children}</label>;
}
export function ErrorMessage({
  message
}: {
  message: string;
}) {
  return message ? <p className="error-message" role="alert">{message}</p> : null;
}
export function Toast({
  message,
  onClose
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return <div className="toast" role="status"><span>✓</span>{message}<button onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button></div>;
}
export function downloadCSV(name: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/^[=+@\-]/, "'").replaceAll('"', '""')}"`;
  const data = [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + data], {
    type: 'text/csv;charset=utf-8;'
  }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

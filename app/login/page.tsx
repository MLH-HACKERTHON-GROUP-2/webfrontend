'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, ArrowRight, ShieldCheck, HeartPulse, Stethoscope, Check, Mail, LockKeyhole } from 'lucide-react';
import { Brand, ErrorMessage, FormField } from '@/components/ui';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/data';
export default function Login() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = localStorage.getItem('emerald-demo-password') || DEMO_PASSWORD;
    if (String(form.get('email')).toLowerCase() !== DEMO_EMAIL || form.get('password') !== password) {
      setError('Use the demo account below, or reset its password.');
      return;
    }
    setLoading(true);
    sessionStorage.setItem('emerald-session', 'demo');
    router.push('/dashboard');
  }
  function demo() {
    sessionStorage.setItem('emerald-session', 'demo');
    router.push('/dashboard');
  }
  return <div className="auth-page"><div className="auth-story"><Brand light /><div className="auth-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="medical-emblem"><Stethoscope size={91} strokeWidth={1.2} /></div><div className="floating-card card-one"><span className="floating-icon"><HeartPulse size={23} /></span><span><strong>Care that connects.</strong><small>Every patient. Every step.</small></span><span className="live-dot" /></div><div className="floating-card card-two"><span className="check-circle"><Check size={18} /></span><span><strong>A healthier workflow</strong><small>From consultation to recovery</small></span></div><span className="decor-plus plus-one">+</span><span className="decor-plus plus-two">+</span></div><div className="auth-story-text"><span className="eyebrow">MADE FOR THE WAY YOU CARE</span><h2>More connected.<br />More human.<br /><span>Better care.</span></h2><p>Your patients, appointments and pharmacy,<br />together in one thoughtful workspace.</p></div><div className="auth-story-footer"><ShieldCheck size={16} /> A little less admin. A lot more care.</div></div><main className="auth-form-side"><div className="auth-top"><span>EMERALD MEDICAL CENTRE</span><span className="demo-pill"><i />Demo workspace</span></div><div className="auth-form"><div className="auth-small-icon"><HeartPulse size={26} /></div><h1>Welcome back.</h1><p>Good care starts with you. Sign in to your workspace.</p><form onSubmit={submit}><FormField label="Email address"><div className="input-with-icon"><Mail size={17} /><input type="email" name="email" autoComplete="username" placeholder="you@emerald.care" defaultValue={DEMO_EMAIL} required /></div></FormField><div className="password-label"><span>Password</span><Link href="/password-reset">Forgot password?</Link></div><div className="input-with-icon"><LockKeyhole size={17} /><input aria-label="Password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required minLength={8} /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><ErrorMessage message={error} /><button className="button primary auth-submit" disabled={loading}>{loading ? 'Opening your workspace…' : 'Sign in'}<ArrowRight size={18} /></button></form><div className="auth-or"><span />or explore the workspace<span /></div><button className="button demo-button" onClick={demo}>Try the interactive demo <ArrowUpRightIcon /></button><div className="demo-credentials"><ShieldCheck size={18} /><p><strong>A safe space to explore</strong>Demo account: {DEMO_EMAIL}<br />Password: {DEMO_PASSWORD}<br />Synthetic data, saved only in this browser.</p></div></div><div className="auth-footer"><span>© 2026 Emerald Care</span><span>Thoughtfully built for better care.</span></div></main></div>;
}
function ArrowUpRightIcon() {
  return <ArrowRight size={17} style={{
    transform: 'rotate(-45deg)'
  }} />;
}

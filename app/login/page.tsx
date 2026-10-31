'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck, HeartPulse, Stethoscope, Check, Mail, LockKeyhole } from 'lucide-react';
import { Brand, ErrorMessage, FormField } from '@/components/ui';
import { DEMO_EMAIL } from '@/lib/data';
import { useStore, roleHome } from '@/lib/store';
import { pairingKeyFor } from '@/lib/backend/config';
import { operations } from '@/lib/backend/operations';
export default function Login() {
  const router = useRouter();
  const {
    client,
    signIn,
    user,
    ready,
    mode,
    setMode
  } = useStore();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingPair, setPendingPair] = useState('');
  useEffect(() => {
    const pair = new URLSearchParams(window.location.hash.slice(1)).get('pair') || sessionStorage.getItem(pairingKeyFor(mode)) || '';
    if (pair) {
      setPendingPair(pair);
      sessionStorage.setItem(pairingKeyFor(mode), pair);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [mode]);
  useEffect(() => {
    if (ready && user) router.replace(roleHome(user.role));
  }, [ready, user, router]);
  async function enter(otp: string) {
    setLoading(true);
    setError('');
    try {
      const account = await signIn(identifier, otp);
      router.replace(account.role === 'PATIENT' && pendingPair ? '/portal' : roleHome(account.role));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (sent) return enter(String(form.get('otp')));
    setLoading(true);
    setError('');
    try {
      await client.request(operations.requestOtp, {
        input: {
          identifier
        }
      }, false);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function demo() {
    void enter('000000');
  }
  return <div className="auth-page"><div className="auth-story"><Brand light /><div className="auth-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="medical-emblem"><Stethoscope size={91} strokeWidth={1.2} /></div><div className="floating-card card-one"><span className="floating-icon"><HeartPulse size={23} /></span><span><strong>Care that connects.</strong><small>Every patient. Every step.</small></span><span className="live-dot" /></div><div className="floating-card card-two"><span className="check-circle"><Check size={18} /></span><span><strong>A healthier workflow</strong><small>From consultation to recovery</small></span></div><span className="decor-plus plus-one">+</span><span className="decor-plus plus-two">+</span></div><div className="auth-story-text"><span className="eyebrow">MADE FOR THE WAY YOU CARE</span><h2>More connected.<br />More human.<br /><span>Better care.</span></h2><p>Your patients, appointments and pharmacy,<br />together in one thoughtful workspace.</p></div><div className="auth-story-footer"><ShieldCheck size={16} /> A little less admin. A lot more care.</div></div><main className="auth-form-side"><div className="auth-top"><span>EMERALD MEDICAL CENTRE</span><span className="demo-pill"><i />Connected workspace</span></div><div className="auth-form"><div className="auth-small-icon"><HeartPulse size={26} /></div><h1>Welcome back.</h1><p>Good care starts with you. Sign in to your workspace.</p><div className="backend-mode-switch" role="group" aria-label="Backend mode"><button type="button" className={`button ${mode === 'live' ? 'primary' : ''}`} disabled={!ready || loading} onClick={() => {
            setMode('live');
            setSent(false);
            setError('');
            setIdentifier('');
          }}>Live backend</button><button type="button" className={`button ${mode === 'simulation' ? 'primary' : ''}`} disabled={!ready || loading} onClick={() => {
            setMode('simulation');
            setSent(false);
            setError('');
            setIdentifier(DEMO_EMAIL);
          }}>Simulation</button></div><p className="small-muted">{mode === 'live' ? 'Connected to the supplied ngrok backend. Use your registered account.' : 'Local simulation · start npm run mock:backend · OTP 000000'}</p><form onSubmit={submit}><FormField label={mode === 'live' ? 'Email, phone or username' : 'Email address'}><div className="input-with-icon"><Mail size={17} /><input type={mode === 'live' ? 'text' : 'email'} name="identifier" autoComplete="username" value={identifier} onChange={e => {
                setIdentifier(e.target.value);
                setSent(false);
              }} required /></div></FormField>{sent && <FormField label="One-time code"><div className="input-with-icon"><LockKeyhole size={17} /><input name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder={mode === 'simulation' ? 'Enter 000000 for local testing' : 'Enter your one-time code'} pattern="[0-9]{6}" required maxLength={6} /></div></FormField>}<ErrorMessage message={error} /><button className="button primary auth-submit" disabled={loading || !ready}>{loading ? 'Opening your workspace…' : sent ? 'Sign in' : 'Request code'}<ArrowRight size={18} /></button><Link href="/password-reset" className="text-link">Need help signing in?</Link></form>{mode === 'simulation' && <><div className="auth-or"><span />or explore the workspace<span /></div><button className="button demo-button" onClick={demo}>Try the interactive demo <ArrowUpRightIcon /></button><FormField label="Choose workspace"><select aria-label="Choose workspace" value={identifier} onChange={e => {
              setIdentifier(e.target.value);
              setSent(false);
            }}>{[['doctor@emerald.care', 'Doctor'], ['pharmacy@emerald.care', 'Pharmacist'], ['patient@emerald.care', 'Patient · Olivia'], ['avery.patient@emerald.care', 'Patient · Avery'], ['hospital@emerald.care', 'Hospital administrator'], ['system@emerald.care', 'System administrator'], ['new.patient@emerald.care', 'New patient']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></FormField></>}<div className="demo-credentials"><ShieldCheck size={18} /><p><strong>{mode === 'live' ? 'Live workspace' : 'Simulation workspace'}</strong>{mode === 'live' ? 'Uses the remote service. No simulated records are substituted when a feature or connection is unavailable.' : 'Test code: 000000. All changes use the local mock backend.'}</p></div></div><div className="auth-footer"><span>© 2026 Emerald Care</span><span>Thoughtfully built for better care.</span></div></main></div>;
}
function ArrowUpRightIcon() {
  return <ArrowRight size={17} style={{
    transform: 'rotate(-45deg)'
  }} />;
}

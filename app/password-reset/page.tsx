'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { Brand, FormField, ErrorMessage } from '@/components/ui';
import { DEMO_EMAIL } from '@/lib/data';
export default function PasswordReset() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const f = new FormData(e.currentTarget);
    if (step === 0) {
      if (String(f.get('email')).toLowerCase() !== DEMO_EMAIL) {
        setError('Only the demo account can be reset in this workspace.');
        return;
      }
      setStep(1);
    } else {
      if (f.get('password') !== f.get('confirm')) {
        setError('Passwords do not match.');
        return;
      }
      localStorage.setItem('emerald-demo-password', String(f.get('password')));
      setStep(2);
    }
  }
  return <div className="reset-page"><Link href="/login"><Brand /></Link><div className="reset-card"><span className="auth-small-icon">{step === 2 ? <CheckCircle2 size={28} /> : <KeyRound size={28} />}</span><span className="eyebrow">LET’S GET YOU BACK TO CARING</span><h1>{step === 0 ? 'Forgot your password?' : step === 1 ? 'A fresh start.' : 'You’re all set.'}</h1><p>{step === 0 ? 'Enter your demo email to reset your workspace password.' : step === 1 ? 'Choose a new password for this browser’s demo account.' : 'Your demo password has been updated in this browser.'}</p>{step < 2 ? <form onSubmit={submit} key={step}>{step === 0 ? <FormField label="Email address"><input name="email" type="email" defaultValue={DEMO_EMAIL} required /></FormField> : <><FormField label="New password"><input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /></FormField><FormField label="Confirm new password"><input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></FormField></>}<ErrorMessage message={error} /><button className="button primary auth-submit">{step === 0 ? 'Continue' : 'Reset demo password'}<ArrowRight size={17} /></button></form> : <Link className="button primary auth-submit" href="/login">Back to sign in <ArrowRight size={17} /></Link>}<div className="reset-note">Demo reset only. No email is sent and no production account is changed.</div><Link className="back-link" href="/login"><ArrowLeft size={15} /> Back to login</Link></div><p className="reset-copyright">© 2026 Emerald Care · Connected care, simplified.</p></div>;
}

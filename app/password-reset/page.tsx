'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, ArrowRight } from 'lucide-react';
import { Brand, FormField, ErrorMessage } from '@/components/ui';
import { useStore, roleHome } from '@/lib/store';
import { operations } from '@/lib/backend/operations';
export default function AccountRecovery() {
  const {
    client,
    signIn,
    mode
  } = useStore();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('doctor@emerald.care'),
    [sent, setSent] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (!sent) {
        await client.request(operations.requestOtp, {
          input: {
            identifier
          }
        }, false);
        setSent(true);
      } else {
        const user = await signIn(identifier, String(f.get('otp')));
        router.replace(roleHome(user.role));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="reset-page"><Link href="/login"><Brand /></Link><div className="reset-card"><span className="auth-small-icon"><KeyRound size={28} /></span><h1>Get back to caring.</h1><p>Your account uses a one-time code. Request a fresh code to sign in again.</p><form onSubmit={submit}><FormField label={mode === 'live' ? 'Email, phone or username' : 'Email address'}><input type="text" value={identifier} onChange={e => {
            setIdentifier(e.target.value);
            setSent(false);
          }} required /></FormField>{sent && <FormField label="One-time code"><input name="otp" pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></FormField>}<ErrorMessage message={error} /><button className="button primary auth-submit" disabled={busy}>{sent ? 'Sign in' : 'Request code'}<ArrowRight size={17} /></button></form><div className="reset-note">{mode === 'simulation' ? 'Local test code: 000000. No recovery email is sent by the mock backend.' : 'Use the one-time code for your registered live account.'}</div><Link className="back-link" href="/login"><ArrowLeft size={15} />Back to login</Link></div></div>;
}

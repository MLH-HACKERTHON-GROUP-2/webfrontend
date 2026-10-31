'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pairingKeyFor } from '@/lib/backend/config';
import { useStore, roleHome } from '@/lib/store';
export default function LegacySimulation() {
  const { user, ready, mode } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('pair');
    if (token) sessionStorage.setItem(pairingKeyFor(mode), token);
    router.replace(user ? token && user.role === 'PATIENT' ? '/portal' : roleHome(user.role) : '/login');
  }, [user, ready, router, mode]);
  return <p className="panel-body">Opening your workspace…</p>;
}

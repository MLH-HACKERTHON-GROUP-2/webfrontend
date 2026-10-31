'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ArrowRight, Wallet } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { PairingConnection } from '@/lib/backend/types';
import { PageHeading, Panel } from '@/components/ui';
import { StaffPairing } from './pairing';
import { LivePatientScan } from './live-features';
import { money } from '@/lib/data';
export function ConnectionsPanel() {
  const {
    client,
    run,
    busy,
    reload,
    user,
    mode
  } = useStore();
  const [pair, setPair] = useState<PairingConnection | null>(null);
  const receive = useCallback((next: PairingConnection) => {
    setPair(next);
    void reload().catch(() => {});
  }, [reload]);
  if (mode === 'live') return <LivePatientScan />;
  return <><StaffPairing client={client} busy={busy} run={run} onConnection={receive} />{pair?.status === 'APPROVED' && pair.patient && <div className="connected-patient-actions"><Link className="button primary" href={user?.role === 'DOCTOR' ? `/session?patient=${pair.patient.publicId}` : `/pharmacy?patient=${pair.patient.publicId}`}><ArrowRight size={16} />{user?.role === 'DOCTOR' ? 'Open consultation' : 'Open prescription queue'}</Link><Link className="button" href={`/records?patient=${pair.patient.publicId}`}>View patient records</Link></div>}</>;
}
export default function Connections() {
  const {
    state,
    mode,
    user
  } = useStore();
  return <><PageHeading eyebrow="CONNECTED CARE" title="Patient connections" description="Let your patient scan and approve sharing their information with your workspace." /><ConnectionsPanel />{(mode === 'simulation' || user?.role === 'PHARMACY') && <Panel title="Payments received"><div className="panel-body"><p className="small-muted"><Wallet size={16} /> Your workspace wallet: <strong>{money(state.wallet || 0)}</strong></p>{state.payments?.slice().reverse().map(p => <div className="simulation-price" key={p.id}><span>{p.kind === 'CONSULTATION' ? 'Consultation' : 'Medicine served'}<small className="block-muted">{new Date(p.occurredAt).toLocaleString('en-ZA')}</small></span><strong>{money(-p.amount)}</strong></div>)}</div></Panel>}</>;
}

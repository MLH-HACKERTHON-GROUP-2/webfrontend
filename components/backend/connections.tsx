'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ArrowRight, QrCode, Wallet } from 'lucide-react';
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
  if (mode === 'live') return <><Panel title="Generate a staff connection QR" subtitle="Create a one-time QR for patients to connect to this workspace."><div className="panel-body connection-qr-unavailable"><span className="connection-qr-icon"><QrCode size={28} /></span><div><strong>Staff QR generation is not enabled for Live yet</strong><p>The connected backend does not provide the pairing operation required to create a staff connection QR. To connect now, ask the patient to sign in, open <b>My care → My patient QR</b>, and scan that code below.</p></div><button className="button" disabled title="The Live backend does not expose staff QR pairing yet"><QrCode size={16} />Generate connection QR</button></div></Panel><LivePatientScan /></>;
  return <><StaffPairing client={client} busy={busy} run={run} onConnection={receive} />{pair?.status === 'APPROVED' && pair.patient && <div className="connected-patient-actions"><Link className="button primary" href={user?.role === 'DOCTOR' ? `/session?patient=${pair.patient.publicId}` : `/pharmacy?patient=${pair.patient.publicId}`}><ArrowRight size={16} />{user?.role === 'DOCTOR' ? 'Open consultation' : 'Open prescription queue'}</Link><Link className="button" href={`/records?patient=${pair.patient.publicId}`}>View patient records</Link></div>}</>;
}
export default function Connections() {
  const {
    state,
    mode,
    user
  } = useStore();
  return <><PageHeading eyebrow="CONNECTED CARE" title="Patient connections" description={mode === 'live' ? 'Connect through a patient-generated QR, or generate a staff QR in Simulation mode.' : 'Generate a one-time staff QR or scan a patient QR to securely share information.'} /><ConnectionsPanel />{(mode === 'simulation' || user?.role === 'PHARMACY') && <Panel title="Payments received"><div className="panel-body"><p className="small-muted"><Wallet size={16} /> Your workspace wallet: <strong>{money(state.wallet || 0)}</strong></p>{state.payments?.slice().reverse().map(p => <div className="simulation-price" key={p.id}><span>{p.kind === 'CONSULTATION' ? 'Consultation' : 'Medicine served'}<small className="block-muted">{new Date(p.occurredAt).toLocaleString('en-ZA')}</small></span><strong>{money(-p.amount)}</strong></div>)}</div></Panel>}</>;
}

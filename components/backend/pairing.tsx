'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Copy, Link2, QrCode, RefreshCw, ShieldCheck, Unplug, Wallet } from 'lucide-react';
import { Panel, Empty, FormField } from '@/components/ui';
import { ScanPatient } from '@/components/qr';
import { SimulationClient, extractPairingToken } from '@/lib/backend/client';
import { operations } from '@/lib/backend/operations';
import type { BackendUser, LoginQr, PairingConnection, PairingPreview } from '@/lib/backend/types';
import { money } from '@/lib/data';
type Run = (action: () => Promise<void>) => Promise<void>;
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
function seconds(expires: string | null, now: number) {
  return expires ? Math.max(0, Math.ceil((new Date(expires).getTime() - Math.max(now, Date.now())) / 1000)) : 0;
}
function providerLabel(provider: BackendUser) {
  return provider.role === 'DOCTOR' ? 'Doctor' : 'Pharmacy';
}
export function StaffPairing({
  client,
  run,
  busy,
  onConnection
}: {
  client: SimulationClient;
  run: Run;
  busy: boolean;
  onConnection: (pair: PairingConnection) => void;
}) {
  const [pair, setPair] = useState<PairingConnection | null>(null);
  const [qr, setQr] = useState<LoginQr | null>(null);
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const now = useNow();
  const selectedId = useRef<string | null>(null);
  const interaction = useRef(false);
  const requestNumber = useRef(0);
  const terminal = useRef(false);
  const onConnectionRef = useRef(onConnection);
  useLayoutEffect(() => {
    onConnectionRef.current = onConnection;
  }, [onConnection]);
  useEffect(() => () => {
    selectedId.current = null;
    requestNumber.current += 1;
  }, []);
  const accept = useCallback((next: PairingConnection) => {
    if (selectedId.current !== next.id || terminal.current && ['WAITING', 'APPROVED'].includes(next.status)) return;
    if (['REVOKED', 'EXPIRED'].includes(next.status)) terminal.current = true;
    setPair(next);
    onConnectionRef.current(next);
    if (next.status !== 'WAITING') {
      setQr(null);
      setImage('');
    }
  }, []);
  const pairId = pair?.id;
  const refresh = useCallback(async () => {
    if (!pairId) return;
    const request = ++requestNumber.current;
    const result = await client.request<{
      pairingConnection: PairingConnection;
    }>(operations.pairingConnection, {
      id: pairId
    });
    if (request === requestNumber.current && selectedId.current === pairId) accept(result.pairingConnection);
  }, [client, pairId, accept]);
  useEffect(() => {
    let alive = true;
    client.request<{
      myPairings: PairingConnection[];
    }>(operations.myPairings).then(result => {
      const active = result.myPairings.find(p => p.status === 'APPROVED');
      if (alive && active && !interaction.current) {
        selectedId.current = active.id;
        terminal.current = false;
        accept(active);
      }
    }).catch(() => {
      if (alive) setStatus('Could not restore connections. Generate a new code or try Refresh.');
    });
    return () => {
      alive = false;
    };
  }, [client, accept]);
  useEffect(() => {
    if (!pairId) return;
    let alive = true;
    const update = () => {
      void refresh().catch(() => {
        if (alive) setStatus('Connection update unavailable. Use Refresh connection.');
      });
    };
    const stop = client.watchPairing(pairId, update, value => {
      if (!alive) return;
      setStatus(value);
      if (value === 'Live updates connected') update();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [client, pairId, refresh]);
  const deadline = pair?.status === 'WAITING' ? pair.expiresAt : pair?.status === 'APPROVED' ? pair.connectionExpiresAt : null;
  useEffect(() => {
    if (!deadline || !pair) return;
    const timer = setTimeout(() => {
      // Clear shared data locally even if the backend is unreachable at expiry.
      accept({ ...pair, status: 'EXPIRED', patient: null, pendingItems: [], payments: [] });
      void refresh().catch(() => setStatus('Connection expired. Generate a new login QR.'));
    }, Math.max(0, new Date(deadline).getTime() - Date.now()) + 100);
    return () => clearTimeout(timer);
  }, [deadline, pair, refresh, accept]);
  useEffect(() => {
    let alive = true;
    setImage('');
    if (qr) void QRCode.toDataURL(qr.pairingUrl, {
      width: 420,
      margin: 2,
      color: {
        dark: '#06543e',
        light: '#ffffff'
      }
    }).then(src => {
      if (alive) setImage(src);
    }).catch(() => {
      if (alive) setStatus('Could not draw QR. Use the pairing link below.');
    });
    return () => {
      alive = false;
    };
  }, [qr]);
  const active = pair?.status === 'APPROVED' && seconds(pair.connectionExpiresAt, now) > 0;
  const waiting = pair?.status === 'WAITING' && seconds(pair.expiresAt, now) > 0;
  return <Panel title="One-time login QR" subtitle="Let the patient scan your code to connect their app to this workspace" action={<Link2 size={19} className="muted" />}>
    <div className="pairing-layout panel-body">
      <div className="pairing-code">
        {waiting && image ? <img src={image} width={210} height={210} alt="One-time login QR for patient pairing" /> : <div className={`pairing-placeholder ${active ? 'connected' : ''}`}>{active ? <CheckCircle2 size={58} /> : <QrCode size={58} />}<strong>{active ? 'Patient connected' : pair && !waiting ? 'Connection ended' : 'Ready to connect'}</strong><p>{active ? pair.patient?.user.name : 'Generate a code, then ask the patient to scan and approve.'}</p></div>}
        {waiting && <><span className="pairing-timer" role="status">Waiting for patient · expires in {seconds(pair.expiresAt, now)}s</span><label>One-time pairing link<input aria-label="One-time pairing link" readOnly value={qr?.pairingUrl || ''} onFocus={e => e.target.select()} /></label><button className="button small" disabled={!qr} onClick={async () => {
            try {
              await navigator.clipboard.writeText(qr!.pairingUrl);
              setCopied(true);
            } catch {
              setCopied(false);
              setStatus('Select and copy the pairing link above.');
            }
          }}><Copy size={14} />{copied ? 'Copied pairing link' : 'Copy pairing link'}</button></>}
        <button className="button primary full-width" disabled={busy} onClick={() => run(async () => {
          interaction.current = true;
          const result = await client.request<{
            createLoginQr: LoginQr;
          }>(operations.createLoginQr);
          selectedId.current = result.createLoginQr.connection.id;
          terminal.current = false;
          requestNumber.current += 1;
          setQr(result.createLoginQr);
          setCopied(false);
          accept(result.createLoginQr.connection);
        })}><QrCode size={16} />{pair ? 'Generate new login QR' : 'Generate login QR'}</button>
        {pair && ['WAITING', 'APPROVED'].includes(pair.status) && <button className="button full-width" disabled={busy} onClick={() => run(async () => {
          const result = await client.request<{
            revokePairing: PairingConnection;
          }>(operations.revokePairing, {
            id: pair.id
          });
          accept(result.revokePairing);
        })}><Unplug size={15} />{active ? 'Disconnect patient' : 'Cancel login QR'}</button>}
      </div>
      <div className="pairing-details"><h3>{active ? 'Shared patient information' : 'How the connection works'}</h3>{active && pair.patient ? <><div className="pairing-patient"><strong>{pair.patient.user.name}</strong><span>{pair.patient.publicId} · {pair.patient.age ?? '—'} years · {pair.patient.gender || 'Not recorded'}</span><span>Blood group: {pair.patient.bloodGroup || 'Not recorded'}</span><span className="danger-text">Allergies: {pair.patient.allergies || 'Not recorded'}</span></div><div className="pairing-wallet"><Wallet size={18} /><div><small>Patient wallet balance</small><strong>{money(pair.patient.wallet.balance)}</strong></div></div><div className="pairing-totals"><span>{pair.patient.sessions.length} medical sessions</span><span>{pair.pendingItems.length} pending prescription items</span></div><h3>Payments with this provider</h3>{pair.payments.length ? pair.payments.slice().reverse().map(payment => <div className="pairing-payment" key={payment.id}><span>{payment.kind === 'CONSULTATION' ? 'Consultation' : 'Medicine dispensed'}<small>{new Date(payment.occurredAt).toLocaleString('en-ZA')}</small></span><strong>{money(-payment.amount)}</strong></div>) : <p className="small-muted">No payments recorded with this provider yet.</p>}<p className="small-muted">Connection ends in {Math.ceil(seconds(pair.connectionExpiresAt, now) / 60)} min. Pairing does not charge the patient.</p></> : <><ol className="pairing-steps"><li>Generate a one-time QR for this doctor or pharmacy.</li><li>The patient scans it using their app or opens the pairing link.</li><li>They sign in and approve sharing records, prescriptions and payment information.</li><li>The connected patient appears here automatically.</li></ol><div className="pairing-consent-note"><ShieldCheck size={18} /><p>The code expires in two minutes and works once. Approved connections last 30 minutes and can be ended by either person.</p></div></>}
        {pairId && <button className="text-link" disabled={busy} onClick={() => run(refresh)}><RefreshCw size={14} />Refresh connection</button>}
        {status && <p className="pairing-live">{status}</p>}
      </div>
    </div>
  </Panel>;
}
export function PatientPairing({
  client,
  run,
  busy,
  initialToken
}: {
  client: SimulationClient;
  run: Run;
  busy: boolean;
  initialToken: string;
}) {
  const [input, setInput] = useState(initialToken),
    [preview, setPreview] = useState<PairingPreview | null>(null),
    [token, setToken] = useState('');
  const [camera, setCamera] = useState(false),
    [connections, setConnections] = useState<PairingConnection[]>([]),
    [notice, setNotice] = useState('');
  const now = useNow();
  const latestRead = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++latestRead.current;
    const result = await client.request<{
      myPairings: PairingConnection[];
    }>(operations.myPairings);
    if (request === latestRead.current) setConnections(result.myPairings);
  }, [client]);
  useEffect(() => {
    if (initialToken) setInput(initialToken);
  }, [initialToken]);
  useEffect(() => {
    void refresh().catch(() => setNotice('Could not load connections. Use Refresh connections.'));
  }, [refresh]);
  const ids = connections.filter(pair => pair.status === 'APPROVED').map(pair => pair.id).join(',');
  useEffect(() => {
    const stops = ids ? ids.split(',').map(id => client.watchPairing(id, () => {
      void refresh().catch(() => {});
    }, status => {
      if (status === 'Live updates connected') void refresh().catch(() => {});
    })) : [];
    return () => stops.forEach(stop => stop());
  }, [client, ids, refresh]);
  async function review(value: string) {
    setPreview(null);
    const next = extractPairingToken(value);
    const result = await client.request<{
      previewLoginQr: PairingPreview;
    }>(operations.previewLoginQr, {
      token: next
    });
    setToken(next);
    setPreview(result.previewLoginQr);
    setNotice('');
  }
  const active = connections.filter(pair => pair.status === 'APPROVED' && seconds(pair.connectionExpiresAt, now) > 0);
  return <Panel title="Connect to a doctor or pharmacy" subtitle="Scan their one-time login QR and choose whether to share your information">
    <div className="panel-body simulation-form"><form className="simulation-scan" onSubmit={e => {
        e.preventDefault();
        void run(() => review(input));
      }}><FormField label="Staff login QR or pairing link"><input value={input} onChange={e => {
            setInput(e.target.value);
            setPreview(null);
          }} placeholder="Paste the doctor or pharmacy’s pairing link" required autoComplete="off" /></FormField><button type="button" className="button" disabled={busy} onClick={() => setCamera(true)}><QrCode size={16} />Scan login QR</button><button className="button primary" disabled={busy}>Review connection</button></form>
      {preview && <section className="pairing-approval" aria-label="Approve patient connection"><span className="pairing-provider-role">{providerLabel(preview.provider)} requesting access</span><h3>{preview.provider.name}</h3><p>{preview.provider.identifier}</p><ul><li>Your patient information and medical records</li><li>Pending prescriptions and your wallet balance</li><li>Payment activity with this provider</li></ul><p>Sharing lasts 30 minutes. You can disconnect at any time. Approval does not sign the provider in as you and does not make a payment.</p><div className="simulation-form-actions"><button className="button" disabled={busy} onClick={() => {
            setPreview(null);
            setToken('');
          }}>Decline</button><button className="button primary" disabled={busy || seconds(preview.expiresAt, now) === 0} onClick={() => run(async () => {
            await client.request(operations.approveLoginQr, {
              token
            });
            setPreview(null);
            setInput('');
            setToken('');
            await refresh();
            setNotice(`Connected to ${preview.provider.name}. Your provider can now read the shared information.`);
          })}><ShieldCheck size={16} />Approve connection</button></div>{seconds(preview.expiresAt, now) === 0 && <p className="danger-text">This code expired. Ask for a new login QR.</p>}</section>}
      {notice && <p className="pairing-notice" role="status">{notice}</p>}
      <div className="pairing-connections-heading"><h3>Your active connections</h3><button className="text-link" disabled={busy} onClick={() => run(refresh)}><RefreshCw size={14} />Refresh connections</button></div>
      {!active.length ? <Empty title="No active connections" text="Scan a staff login QR when you are ready to share." /> : active.map(pair => <div className="pairing-connection-row" key={pair.id}><span><strong>{pair.provider.name}</strong><small>{providerLabel(pair.provider)} · {Math.ceil(seconds(pair.connectionExpiresAt, now) / 60)} min remaining</small></span><button className="button small" disabled={busy} onClick={() => run(async () => {
          await client.request(operations.revokePairing, {
            id: pair.id
          });
          await refresh();
          setNotice('Disconnected. This provider can no longer use the shared connection.');
        })}><Unplug size={14} />Disconnect</button></div>)}
    </div>{camera && <ScanPatient title="Scan staff login QR" description="Scan the code displayed by your doctor or pharmacy, then review the connection." onClose={() => setCamera(false)} onScan={value => {
      setCamera(false);
      setInput(value);
      void run(() => review(value));
    }} />}
  </Panel>;
}

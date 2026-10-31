'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Plus, ScanLine, Search, Pill, Package, TriangleAlert, ClipboardList, ArrowUpRight, LayoutGrid, List, CheckCircle2, ArrowDownToLine, Download, ShieldCheck } from 'lucide-react';
import { useStore } from '@/lib/store';
import { TODAY, money, dateLabel, type Prescription, type Medicine } from '@/lib/data';
import { PageHeading, Panel, Stat, Badge, Toast, Empty, Modal, FormField, ErrorMessage, downloadCSV } from '@/components/ui';
import PatientBanner from '@/components/patient-banner';
import { ScanPatient } from '@/components/qr';
export default function Pharmacy() {
  const searchParams = useSearchParams();
  const {
    state,
    addMedicine,
    dispense,
    receiveStock
  } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [stock, setStock] = useState('All stock');
  const [view, setView] = useState('grid');
  const [tab, setTab] = useState('Medicine catalog');
  const [newMedicine, setNewMedicine] = useState(false);
  const [scan, setScan] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [serving, setServing] = useState<Prescription | null>(null);
  const [receiving, setReceiving] = useState<Medicine | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (searchParams.get('filter') === 'low') setStock('Low stock');
  }, [searchParams]);
  const categories = Array.from(new Set(state.medicines.map(m => m.category)));
  const medicines = state.medicines.filter(m => (m.name + ' ' + m.generic + ' ' + m.id).toLowerCase().includes(query.toLowerCase()) && (category === 'All categories' || m.category === category) && (stock === 'All stock' || (stock === 'Low stock' ? m.stock <= m.threshold : stock === 'In stock' ? m.stock > m.threshold : m.expiry < TODAY)));
  const pending = state.prescriptions.filter(r => r.status === 'Pending');
  const patient = state.patients.find(p => p.id === patientId);
  function submitMedicine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const strength = String(f.get('strength')).trim();
    if (state.medicines.some(m => m.name.toLowerCase() === name.toLowerCase() && m.strength.toLowerCase() === strength.toLowerCase())) {
      setError('This medicine and strength already exist. Receive stock instead.');
      return;
    }
    const quantity = Number(f.get('stock'));
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError('Stock must be a non-negative whole number.');
      return;
    }
    addMedicine({
      name,
      generic: String(f.get('generic')).trim(),
      category: String(f.get('category')),
      strength,
      stock: quantity,
      threshold: Number(f.get('threshold')),
      price: Number(f.get('price')),
      expiry: String(f.get('expiry'))
    });
    setNewMedicine(false);
    setToast('Medicine added to the catalog');
  }
  function exportCatalog() {
    downloadCSV('emerald-medicine-catalog.csv', ['Medicine', 'Generic', 'Strength', 'Category', 'Stock', 'Unit price (ZAR)', 'Expiry'], medicines.map(m => [m.name, m.generic, m.strength, m.category, m.stock, m.price, m.expiry]));
  }
  return <><PageHeading eyebrow="THE NEXT STEP IN THEIR CARE" title="Pharmacy" description="From prescription to patient. Keep care moving." actions={<><button className="button" onClick={() => setScan(true)}><ScanLine size={17} /> Scan patient QR</button><button className="button primary" onClick={() => {
        setError('');
        setNewMedicine(true);
      }}><Plus size={17} /> Add medicine</button></>} /><div className="stats-grid"><Stat label="Medicine catalog" value={state.medicines.length} detail="Medicines in your inventory" icon={<Pill size={19} />} accent /><Stat label="Units in stock" value={state.medicines.reduce((s, m) => s + m.stock, 0).toLocaleString()} detail="Across all medicine categories" icon={<Package size={19} />} /><Stat label="Low-stock items" value={state.medicines.filter(m => m.stock <= m.threshold).length} detail="Ready for a little restocking" icon={<TriangleAlert size={19} />} /><Stat label="Pending prescriptions" value={pending.length} detail="Waiting to reach their patients" icon={<ClipboardList size={19} />} /></div><div className="pharmacy-scan-banner"><span className="scan-banner-icon"><ScanLine size={27} /></span><div><strong>A quick scan. A clear picture.</strong><p>Scan a patient’s QR code to view medical information and serve pending prescriptions.</p></div><button className="button" onClick={() => setScan(true)}>Scan patient QR <ArrowUpRight size={16} /></button></div><div className="tabs pharmacy-tabs">{['Medicine catalog', 'Prescription queue'].map(t => <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>{t}{t === 'Prescription queue' && <span className="count-chip">{pending.length}</span>}</button>)}</div>{tab === 'Medicine catalog' ? <Panel title="Medicine catalog" subtitle="A well-stocked pharmacy. A better patient experience." action={<div className="catalog-actions"><button className="button small" onClick={exportCatalog}><Download size={14} /> Export</button><div className="segmented"><button aria-label="Grid view" onClick={() => setView('grid')} className={view === 'grid' ? 'selected' : ''}><LayoutGrid size={16} /></button><button aria-label="Table view" onClick={() => setView('table')} className={view === 'table' ? 'selected' : ''}><List size={17} /></button></div></div>}><div className="table-toolbar"><div className="local-search"><Search size={17} /><input aria-label="Search medicines" placeholder="Search medicines or generic names…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="filter-group"><select aria-label="Medicine category" value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Stock filter" value={stock} onChange={e => setStock(e.target.value)}>{['All stock', 'In stock', 'Low stock', 'Expired'].map(s => <option key={s}>{s}</option>)}</select></div></div>{view === 'grid' ? <div className="medicine-grid">{medicines.map((m, i) => <div className="medicine-card" key={m.id}><div className="medicine-card-top"><span className={`medicine-art art-${i % 4}`}><Pill size={32} strokeWidth={1.4} /><span className="medicine-art-dot" /></span><Badge>{m.expiry < TODAY ? 'Expired' : m.stock <= m.threshold ? 'Low stock' : 'In stock'}</Badge></div><span className="medicine-category">{m.category}</span><h3>{m.name} <span>{m.strength}</span></h3><p>{m.generic}</p><div className="medicine-stock"><span>Available stock</span><strong className={m.stock <= m.threshold ? 'warning-text' : ''}>{m.stock} <small>units</small></strong></div><div className="stock-track"><span style={{
              width: `${Math.min(100, m.stock / Math.max(1, m.threshold * 5) * 100)}%`
            }} className={m.stock <= m.threshold ? 'low' : ''} /></div><div className="medicine-card-footer"><span>{money(m.price)}<small> / unit</small></span><button className="text-link" onClick={() => {
              setError('');
              setReceiving(m);
            }}><Plus size={14} /> Receive stock</button></div></div>)}</div> : <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Price / unit</th><th>Expiry</th><th>Status</th><th /></tr></thead><tbody>{medicines.map(m => <tr key={m.id}><td><strong>{m.name} {m.strength}</strong><small className="block-muted">{m.generic}</small></td><td>{m.category}</td><td>{m.stock}</td><td>{money(m.price)}</td><td>{dateLabel(m.expiry)}</td><td><Badge>{m.expiry < TODAY ? 'Expired' : m.stock <= m.threshold ? 'Low stock' : 'In stock'}</Badge></td><td><button className="text-link" onClick={() => {
                  setError('');
                  setReceiving(m);
                }}>Receive stock</button></td></tr>)}</tbody></table></div>}{!medicines.length && <Empty />}<div className="table-footer">Showing {medicines.length} of {state.medicines.length} medicines<span>Inventory updates automatically when prescriptions are served.</span></div></Panel> : <Panel title="Prescription queue" subtitle="The last step before their medicine reaches them"><div className="table-wrap"><table><thead><tr><th>Patient</th><th>Medicine</th><th>Quantity</th><th>Date</th><th>Status</th><th /></tr></thead><tbody>{state.prescriptions.slice().reverse().map(rx => {
              const p = state.patients.find(p => p.id === rx.patientId)!;
              const m = state.medicines.find(m => m.id === rx.medicineId)!;
              return <tr key={rx.id}><td><strong>{p.name}</strong><small className="block-muted">{p.id}</small></td><td><strong>{m.name} {m.strength}</strong><small className="block-muted">{rx.id}</small></td><td>{rx.quantity}</td><td>{dateLabel(rx.date)}</td><td><Badge>{rx.status}</Badge></td><td><button className="text-link" onClick={() => setPatientId(p.id)}>Review patient <ArrowUpRight size={15} /></button></td></tr>;
            })}</tbody></table>{!state.prescriptions.length && <Empty title="No prescriptions yet" />}</div></Panel>}{newMedicine && <Modal title="Add new medicine" description="Build a catalog that keeps your practice ready." onClose={() => setNewMedicine(false)}><form onSubmit={submitMedicine}><div className="form-grid"><FormField label="Medicine name"><input name="name" placeholder="e.g. Paracetamol" required maxLength={100} /></FormField><FormField label="Generic name"><input name="generic" placeholder="e.g. Acetaminophen" required maxLength={150} /></FormField><FormField label="Strength"><input name="strength" placeholder="e.g. 500 mg" required maxLength={50} /></FormField><FormField label="Category"><select name="category">{[...categories, 'Other'].map(c => <option key={c}>{c}</option>)}</select></FormField><FormField label="Opening stock (units)"><input name="stock" type="number" min="0" max="1000000" step="1" required /></FormField><FormField label="Low-stock threshold"><input name="threshold" type="number" min="0" max="100000" step="1" defaultValue="20" required /></FormField><FormField label="Price per unit (ZAR)"><input name="price" type="number" min="0" max="100000" step="0.01" required /></FormField><FormField label="Expiry date"><input name="expiry" type="date" min={TODAY} required /></FormField></div><ErrorMessage message={error} /><div className="modal-actions"><button type="button" className="button" onClick={() => setNewMedicine(false)}>Cancel</button><button className="button primary">Add medicine</button></div></form></Modal>}{scan && <ScanPatient patients={state.patients} onClose={() => setScan(false)} onFound={id => {
      setScan(false);
      setPatientId(id);
    }} />}{patient && <Modal wide title="Patient & prescriptions" description="Review patient information before serving medication." onClose={() => setPatientId(null)}><div className="dispense-body"><PatientBanner patient={patient} /><div className="dispense-diagnoses"><h3>Medical information</h3><p><strong>Primary case:</strong> {patient.case}</p>{state.diagnoses.filter(d => d.patientId === patient.id).map(d => <span className="code-tag" key={d.id}>{d.code} · {d.name}</span>)}<Link href={`/records?patient=${patient.id}`} className="text-link">View complete medical record <ArrowUpRight size={14} /></Link></div><h3 className="prescription-section-title">Pending prescriptions <span className="count-chip">{pending.filter(r => r.patientId === patient.id).length}</span></h3>{pending.filter(r => r.patientId === patient.id).map(rx => {
          const m = state.medicines.find(m => m.id === rx.medicineId)!;
          return <div className="dispense-prescription" key={rx.id}><div className="dispense-prescription-heading"><span className="record-icon"><Pill size={21} /></span><div><h3>{m.name} {m.strength}</h3><small>{rx.id} · {dateLabel(rx.date)}</small></div><Badge>{rx.status}</Badge></div><div className="detail-grid"><div><span>Dosage / frequency</span><strong>{rx.dosage}</strong></div><div><span>Duration</span><strong>{rx.duration}</strong></div><div><span>Quantity prescribed</span><strong>{rx.quantity} units</strong></div><div><span>Available stock</span><strong className={m.stock < rx.quantity ? 'danger-text' : ''}>{m.stock} units</strong></div></div><p className="rx-instructions">{rx.instructions || 'No additional instructions recorded.'}</p><button className="button primary" disabled={m.stock < rx.quantity || m.expiry < TODAY} onClick={() => {
              setError('');
              setServing(rx);
            }}><CheckCircle2 size={16} />{m.stock < rx.quantity ? 'Insufficient stock' : m.expiry < TODAY ? 'Medicine expired' : 'Serve prescription'}</button></div>;
        })}{!pending.some(r => r.patientId === patient.id) && <Empty title="All caught up." text="This patient has no pending prescriptions." />}{state.prescriptions.some(r => r.patientId === patient.id && r.status === 'Dispensed') && <div className="dispensed-note"><CheckCircle2 size={17} />{state.prescriptions.filter(r => r.patientId === patient.id && r.status === 'Dispensed').length} prescription(s) already served for this patient.</div>}</div><div className="modal-actions"><button className="button" onClick={() => setPatientId(null)}>Close patient</button></div></Modal>}{serving && <Modal title="Confirm medicine served" description="Confirm that the prescribed medication has been handed to the patient." onClose={() => setServing(null)}><div className="panel-body"><div className="inline-alert neutral"><ShieldCheck size={19} /><span>Confirm patient identity, allergies, medicine and instructions before recording this dispense.</span></div><div className="serve-summary"><strong>{state.medicines.find(m => m.id === serving.medicineId)!.name}</strong><span>{serving.quantity} units · {state.patients.find(p => p.id === serving.patientId)!.name}</span></div><p className="small-muted">This marks the prescription as dispensed, deducts stock, and records the movement in reports.</p><ErrorMessage message={error} /></div><div className="modal-actions"><button className="button" onClick={() => setServing(null)}>Go back</button><button className="button primary" onClick={() => {
          try {
            dispense(serving.id);
            setServing(null);
            setToast('Prescription served. Stock and reports updated.');
          } catch (e) {
            setError((e as Error).message);
          }
        }}>Confirm served</button></div></Modal>}{receiving && <Modal title="Receive medicine stock" description={`${receiving.name} ${receiving.strength} · ${receiving.stock} units currently available`} onClose={() => setReceiving(null)}><form onSubmit={e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          receiveStock(receiving.id, Number(f.get('quantity')));
          setReceiving(null);
          setToast('Stock received and movement recorded');
        } catch (e) {
          setError((e as Error).message);
        }
      }}><div className="form-grid"><FormField label="Quantity received (units)" wide><input name="quantity" type="number" min="1" max="1000000" step="1" required /></FormField><p className="small-muted full">For this demo, received stock keeps the catalog expiry date: {dateLabel(receiving.expiry)}.</p></div><ErrorMessage message={error} /><div className="modal-actions"><button type="button" className="button" onClick={() => setReceiving(null)}>Cancel</button><button className="button primary">Receive stock</button></div></form></Modal>}{toast && <Toast message={toast} onClose={() => setToast('')} />}</>;
}

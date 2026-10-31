'use client';

import Link from 'next/link';
import { AlertTriangle, FolderHeart, Phone, Mail, QrCode } from 'lucide-react';
import { type Patient } from '@/lib/data';
import { Avatar } from './ui';
export default function PatientBanner({
  patient,
  onQR
}: {
  patient: Patient;
  onQR?: () => void;
}) {
  return <section className="patient-banner"><div className="patient-identity"><Avatar person={patient} size="lg" /><div><span className="patient-id">{patient.id}</span><h2>{patient.name}</h2><p>{patient.age} years old <i /> {patient.gender} <i /> Blood group {patient.blood}</p></div></div><div className="patient-contact"><span><Phone size={14} />{patient.phone}</span><span><Mail size={14} />{patient.email}</span></div><div className="patient-banner-actions">{onQR ? <button className="button" onClick={onQR}><QrCode size={16} /> Patient QR code</button> : <Link className="button" href={`/records?patient=${patient.id}`}><FolderHeart size={16} /> Medical records</Link>}<span className={`allergy-note ${patient.allergies === 'None known' ? 'safe' : ''}`}><AlertTriangle size={14} />{patient.allergies === 'None known' ? 'No known allergies' : `Allergy: ${patient.allergies}`}</span></div></section>;
}

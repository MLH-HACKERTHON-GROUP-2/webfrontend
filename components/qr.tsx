'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Search, ScanLine, Download, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { type Patient } from '@/lib/data';
import { Modal, FormField, ErrorMessage } from './ui';
export function PatientQR({
  patient,
  onClose
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(patient.id, {
      width: 500,
      margin: 3,
      color: {
        dark: '#065f46',
        light: '#ffffff'
      }
    }).then(setSrc);
  }, [patient.id]);
  return <Modal title="Patient QR code" description="Scan this code in the pharmacy to open the patient’s prescriptions." onClose={onClose}><div className="patient-qr">{src ? <img src={src} width={250} height={250} alt={`QR code for patient ${patient.id}`} /> : <p>Generating QR code…</p>}<h3>{patient.name}</h3><p>{patient.id}</p><small>This code contains only the patient ID.</small></div><div className="modal-actions"><button className="button" onClick={onClose}>Close</button>{src && <a className="button primary" href={src} download={`${patient.id}-qr.png`}><Download size={16} /> Download QR</a>}</div></Modal>;
}
export function ScanPatient({
  patients = [],
  onClose,
  onFound,
  onScan,
  title = "Scan patient QR code",
  description = "Connect the right patient with the right prescription."
}: {
  patients?: Patient[];
  onClose: () => void;
  onFound?: (id: string) => void;
  onScan?: (value: string) => void;
  title?: string;
  description?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(false);
  const mounted = useRef(true);
  const raf = useRef<number>(0);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  function stop() {
    active.current = false;
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    setCamera(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = false;
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach(t => t.stop());
    };
  }, []);
  function resolve(text: string) {
    if (onScan) {
      stop();
      onScan(text.trim());
      return true;
    }
    const normalized = text.trim().toUpperCase();
    const p = patients.find(p => p.id === normalized);
    if (!p) {
      setError('Patient not found. Scan an Emerald Care QR code or enter a valid patient ID.');
      return false;
    }
    stop();
    onFound?.(p.id);
    return true;
  }
  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires HTTPS or localhost. You can enter a patient ID below.');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment'
        },
        audio: false
      });
      if (!mounted.current) {
        media.getTracks().forEach(t => t.stop());
        return;
      }
      stream.current = media;
      setCamera(true);
      active.current = true;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true
      });
      let last = '';
      function tick() {
        if (!active.current) return;
        const v = video.current;
        if (v && v.readyState >= 2 && ctx && v.videoWidth) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: 'dontInvert'
          });
          if (qr && qr.data !== last) {
            last = qr.data;
            if (resolve(qr.data)) return;
          }
        }
        raf.current = requestAnimationFrame(tick);
      }
      raf.current = requestAnimationFrame(tick);
    } catch {
      stop();
      setError('Camera access was unavailable. Allow camera access or enter the patient ID below.');
    }
  }
  return <Modal title={title} description={description} onClose={onClose}><div className="scan-body"><div className={`scanner ${camera ? 'running' : ''}`}><video ref={video} playsInline muted className={camera ? '' : 'hidden'} />{!camera && <><span className="scan-corners"><ScanLine size={62} strokeWidth={1} /></span><p>Position the patient’s QR code inside the frame</p></>}<div className="scanner-frame" />{camera && <div className="scan-line" />}</div><button className="button full-width" onClick={camera ? stop : start}>{camera ? <CameraOff size={17} /> : <Camera size={17} />} {camera ? 'Stop camera' : 'Enable camera'}</button><div className="auth-or"><span />or find the patient<span /></div><form onSubmit={e => {
        e.preventDefault();
        resolve(input);
      }}><FormField label={onScan ? "Patient QR URL or token" : "Patient ID"}><div className="input-with-button"><input value={input} onChange={e => setInput(e.target.value)} placeholder={onScan ? "Paste the patient’s current QR URL" : "e.g. PT-1001"} required /><button className="button primary" aria-label="Look up patient"><Search size={17} /></button></div></FormField><p className="small-muted">{onScan ? 'The backend validates QR expiry and access after scanning.' : 'Try PT-1001 to explore a pending demo prescription.'}</p><ErrorMessage message={error} /></form></div></Modal>;
}

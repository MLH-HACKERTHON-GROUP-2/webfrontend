// Provisional DTOs from mock/schema.provisional.graphql, NOT the absent backend SDL.
export type Role = 'PATIENT' | 'DOCTOR' | 'PHARMACY' | 'HOSPITAL_ADMIN' | 'SYSTEM_ADMIN';
export type BackendUser = {
  id: string;
  name: string;
  identifier: string;
  role: Role;
  profileComplete: boolean;
};
export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
};
export type Item = {
  id: string;
  drugName: string;
  dosage: string;
  quantity: number;
  status: 'PENDING' | 'DISPENSED';
  dispensedAt: string | null;
};
export type Session = {
  id: string;
  status: 'ACTIVE' | 'FINALIZED';
  startedAt: string;
  finalizedAt: string | null;
  patient: {
    id: string;
    publicId: string;
    user: BackendUser;
  };
  doctor: {
    id: string;
    user: BackendUser;
  };
  vitals: {
    bloodPressure: string | null;
    heartRate: number | null;
    temperature: number | null;
    oxygenSaturation: number | null;
    weight: number | null;
  } | null;
  diagnosis: {
    notes: string;
  } | null;
  prescription: {
    items: Item[];
  } | null;
};
export type Patient = {
  id: string;
  publicId: string;
  user: BackendUser;
  age: number | null;
  gender: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  wallet: {
    balance: number;
  };
  sessions: Session[];
};
export type Doctor = {
  id: string;
  user: BackendUser;
  hospitalId: string;
  sessions: Session[];
};
export type Hospital = {
  id: string;
  name: string;
  address: string;
  consultationFee: number;
  wallet: {
    balance: number;
  };
  doctors: {
    id: string;
    user: BackendUser;
  }[];
};
export type Pharmacy = {
  id: string;
  name: string;
  address: string;
  wallet: {
    balance: number;
  };
  drugPrices: {
    drugName: string;
    price: number;
  }[];
};
export type Qr = {
  token: string;
  qrCodeUrl: string;
  expiresAt: string;
};
export type PairingStatus = 'WAITING' | 'APPROVED' | 'REVOKED' | 'EXPIRED';
export type PairingConnection = {
  id: string;
  status: PairingStatus;
  provider: BackendUser;
  expiresAt: string;
  connectionExpiresAt: string | null;
  approvedAt: string | null;
  patient: Patient | null;
  pendingItems: Item[];
  payments: {
    id: string;
    kind: string;
    amount: number;
    balance: number;
    occurredAt: string;
  }[];
};
export type LoginQr = {
  token: string;
  pairingUrl: string;
  connection: PairingConnection;
};
export type PairingPreview = {
  id: string;
  provider: BackendUser;
  expiresAt: string;
};

// Verify every document against the authoritative SDL when it becomes available.
const USER = 'id name identifier role profileComplete';
const ITEMS = 'id drugName dosage quantity status dispensedAt';
const SESSION = `id status startedAt finalizedAt patient { id publicId user { ${USER} } } doctor { id user { ${USER} } } vitals { bloodPressure heartRate temperature oxygenSaturation weight } diagnosis { notes } prescription { items { ${ITEMS} } }`;
const PATIENT = `id publicId user { ${USER} } age gender bloodGroup allergies wallet { balance } sessions { ${SESSION} }`;
const HOSPITAL = `id name address consultationFee wallet { balance } doctors { id user { ${USER} } }`;
const PHARMACY = 'id name address wallet { balance } drugPrices { drugName price }';
const PAIRING = `id status provider { ${USER} } expiresAt connectionExpiresAt approvedAt patient { ${PATIENT} } pendingItems { ${ITEMS} } payments { id kind amount balance occurredAt }`;
export const operations = {
  workspace: 'query MyWorkspace { myWorkspace }',
  workspaceAction: 'mutation WorkspaceAction($kind: WorkspaceAction!, $input: JSON!) { workspaceAction(kind: $kind, input: $input) }',
  me: `query Me { me { ${USER} } }`,
  createLoginQr: `mutation CreateLoginQr { createLoginQr { token pairingUrl connection { ${PAIRING} } } }`,
  previewLoginQr: `query PreviewLoginQr($token: String!) { previewLoginQr(token: $token) { id provider { ${USER} } expiresAt } }`,
  approveLoginQr: `mutation ApproveLoginQr($token: String!) { approveLoginQr(token: $token) { ${PAIRING} } }`,
  pairingConnection: `query PairingConnection($id: ID!) { pairingConnection(id: $id) { ${PAIRING} } }`,
  myPairings: `query MyPairings { myPairings { ${PAIRING} } }`,
  revokePairing: `mutation RevokePairing($id: ID!) { revokePairing(id: $id) { ${PAIRING} } }`,
  startPairedSession: `mutation StartPairedSession($connectionId: ID!) { startPairedSession(connectionId: $connectionId) { ${SESSION} } }`,
  dispensePairedItem: `mutation DispensePairedItem($connectionId: ID!, $itemId: ID!) { dispensePairedItem(connectionId: $connectionId, itemId: $itemId) { ${ITEMS} } }`,
  requestOtp: 'mutation RequestOtp($input: OtpRequestInput!) { requestOtp(input: $input) }',
  verifyOtp: `mutation VerifyOtp($input: OtpVerificationInput!) { verifyOtp(input: $input) { accessToken refreshToken user { ${USER} } } }`,
  refreshToken: `mutation RefreshToken($refreshToken: String!) { refreshToken(refreshToken: $refreshToken) { accessToken refreshToken user { ${USER} } } }`,
  patient: `query Patient { myPatientProfile { ${PATIENT} } }`,
  profile: `mutation CompleteProfile($input: PatientProfileInput!) { completePatientProfile(input: $input) { ${USER} } }`,
  qr: 'mutation GenerateQr { generateQrToken { token qrCodeUrl expiresAt } }',
  topUp: 'mutation TopUp($amount: Float!) { topUpWallet(amount: $amount) { balance } }',
  lookup: `query LookupPatient($token: String!) { patientByQrToken(token: $token) { ${PATIENT} } }`,
  doctor: `query Doctor { myDoctor { id hospitalId user { ${USER} } sessions { ${SESSION} } } }`,
  start: `mutation Start($qrToken: String!) { startSession(qrToken: $qrToken) { ${SESSION} } }`,
  vitals: `mutation Vitals($sessionId: ID!, $input: VitalsInput!) { recordVitals(sessionId: $sessionId, input: $input) { ${SESSION} } }`,
  diagnosis: `mutation Diagnosis($sessionId: ID!, $input: DiagnosisInput!) { recordDiagnosis(sessionId: $sessionId, input: $input) { ${SESSION} } }`,
  prescription: `mutation Prescription($sessionId: ID!, $input: PrescriptionInput!) { createPrescription(sessionId: $sessionId, input: $input) { ${SESSION} } }`,
  finalize: `mutation Finalize($sessionId: ID!) { finalizeSession(sessionId: $sessionId) { ${SESSION} } }`,
  pharmacy: `query Pharmacy { myPharmacy { ${PHARMACY} } }`,
  pending: `query Pending($qrToken: String!) { pendingPrescriptionItems(qrToken: $qrToken) { ${ITEMS} } }`,
  price: 'mutation Price($input: DrugPriceInput!) { setPharmacyDrugPrice(input: $input) { drugName price } }',
  dispense: `mutation Dispense($itemId: ID!) { dispensePrescriptionItem(itemId: $itemId) { ${ITEMS} } }`,
  hospital: `query Hospital { myHospital { ${HOSPITAL} } hospitalSessions { ${SESSION} } }`,
  onboardDoctor: `mutation OnboardDoctor($input: DoctorInput!) { onboardDoctor(input: $input) { id user { ${USER} } } }`,
  system: `query System { allHospitals { ${HOSPITAL} } allPharmacies { ${PHARMACY} } }`,
  onboardHospital: 'mutation OnboardHospital($input: HospitalInput!) { onboardHospital(input: $input) { id name } }',
  onboardPharmacy: 'mutation OnboardPharmacy($input: PharmacyInput!) { onboardPharmacy(input: $input) { id name } }'
};
export const eventSelections = {
  sessionStarted: 'id status',
  sessionFinalized: 'id status',
  prescriptionReady: 'id status',
  prescriptionDispensed: 'id status',
  myPaymentEvents: 'id kind amount balance occurredAt'
};

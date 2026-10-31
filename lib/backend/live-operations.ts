// Validated against backend/schema.live.graphql, obtained from the supplied service.
const USER = 'id name email phone role profileComplete';
const ITEM = 'id drugName dosage quantity instructions status dispensedAt';
const TRANSACTIONS = 'id type direction amount createdAt';
const WALLET = `balance transactions { ${TRANSACTIONS} }`;
const PERSON = `id publicId user { ${USER} } dob sex allergies wallet { ${WALLET} }`;
const SESSION = `id status startedAt finalizedAt patient { ${PERSON} } doctor { id user { ${USER} } } hospital { id name consultationFee } vitals { bloodPressure pulse temperature weightKg notes } diagnosis { id code notes recordedAt } prescription { items { ${ITEM} } }`;
const PATIENT = `${PERSON} sessions { ${SESSION} }`;
const HOSPITAL = `id name address consultationFee wallet { ${WALLET} } doctors { id user { ${USER} } }`;
const PHARMACY = `id name address wallet { ${WALLET} } drugPrices { id drugName price }`;
export const liveOperations = {
  health: 'query Health { health }',
  me: `query Me { me { ${USER} } }`,
  requestOtp: 'mutation RequestOtp($input: RequestOtpInput!) { requestOtp(input: $input) }',
  verifyOtp: `mutation VerifyOtp($input: VerifyOtpInput!) { verifyOtp(input: $input) { accessToken refreshToken user { ${USER} } } }`,
  refreshToken: `mutation RefreshToken($refreshToken: String!) { refreshToken(refreshToken: $refreshToken) { accessToken refreshToken user { ${USER} } } }`,
  patient: `query Patient { myPatientProfile { ${PATIENT} } }`,
  profile: `mutation CompleteProfile($input: CompletePatientProfileInput!) { completePatientProfile(input: $input) { ${PATIENT} } }`,
  qr: 'mutation GenerateQr { generateQrToken { token qrCodeUrl expiresAt } }',
  topUp: `mutation TopUp($amount: Float!) { topUpWallet(amount: $amount) { ${WALLET} } }`,
  lookup: `query LookupPatient($token: ID!) { patientByQrToken(token: $token) { ${PATIENT} } }`,
  active: `query ActiveSession { myActiveSession { ${SESSION} } }`,
  session: `query Session($id: ID!) { session(id: $id) { ${SESSION} } }`,
  start: `mutation Start($qrToken: ID!) { startSession(qrToken: $qrToken) { ${SESSION} } }`,
  vitals: 'mutation Vitals($input: RecordVitalsInput!) { recordVitals(input: $input) { bloodPressure pulse temperature weightKg notes } }',
  diagnosis: 'mutation Diagnosis($input: RecordDiagnosisInput!) { recordDiagnosis(input: $input) { id code notes recordedAt } }',
  prescription: `mutation Prescription($input: CreatePrescriptionInput!) { createPrescription(input: $input) { items { ${ITEM} } } }`,
  finalize: `mutation Finalize($sessionId: ID!) { finalizeSession(sessionId: $sessionId) { ${SESSION} } }`,
  pharmacy: `query Pharmacy { myPharmacy { ${PHARMACY} } }`,
  pending: `query Pending($qrToken: ID!) { pendingPrescriptionItems(qrToken: $qrToken) { ${ITEM} } }`,
  price: 'mutation Price($input: SetPharmacyDrugPriceInput!) { setPharmacyDrugPrice(input: $input) { id drugName price } }',
  dispense: `mutation Dispense($itemId: ID!) { dispensePrescriptionItem(itemId: $itemId) { ${ITEM} } }`,
  hospital: `query Hospital { myHospital { ${HOSPITAL} } }`,
  system: `query System { allHospitals { ${HOSPITAL} } allPharmacies { ${PHARMACY} } }`,
  onboardDoctor: `mutation OnboardDoctor($input: OnboardDoctorInput!) { onboardDoctor(input: $input) { id user { ${USER} } } }`,
  onboardHospital: 'mutation OnboardHospital($input: OnboardHospitalInput!) { onboardHospital(input: $input) { id name } }',
  onboardPharmacy: 'mutation OnboardPharmacy($input: OnboardPharmacyInput!) { onboardPharmacy(input: $input) { id name } }'
};

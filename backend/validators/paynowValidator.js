function isValidPayNowMobile(mobile) {
  if (!mobile || typeof mobile !== 'string') return { valid: false, message: 'Invalid mobile input' };
  // Singapore mobile numbers start with +65 followed by 8 digits, typically starting with 6, 8, or 9
  const regex = /^\+65[689]\d{7}$/;
  const valid = regex.test(mobile);
  return {
    valid,
    message: valid ? 'Valid PayNow Mobile' : 'Mobile must match +65 followed by 8 digits starting with 6, 8, or 9'
  };
}

function isValidUEN(uen) {
  if (!uen || typeof uen !== 'string') return { valid: false, message: 'Invalid UEN input' };
  // Entity UEN has 3 formats:
  // 1. 9 digits followed by a letter (e.g. 197400012W)
  // 2. 10 characters starting with T/S/R/F, followed by 2 digits, 2 letters, 4 digits, 1 letter (e.g. T12LL0001A)
  // 3. 10 characters for society/nric (TSRF followed by 2 digits, society codes, etc.)
  const regex1 = /^\d{9}[A-Z]$/i;
  const regex2 = /^[TSRF]\d{2}[A-Z]{2}\d{4}[A-Z]$/i;
  const valid = regex1.test(uen) || regex2.test(uen);
  return {
    valid,
    message: valid ? 'Valid UEN' : 'UEN must be a valid 9 or 10 character Singapore Entity Number'
  };
}

function isValidNRIC(nric) {
  if (!nric || typeof nric !== 'string') return { valid: false, message: 'Invalid NRIC input' };
  const regex = /^[STFG]\d{7}[A-Z]$/i;
  const valid = regex.test(nric);
  return {
    valid,
    message: valid ? 'Valid NRIC' : 'NRIC must start with S, T, F, or G, followed by 7 digits and a letter'
  };
}

function detectPayNowIdType(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  if (identifier.startsWith('+65')) return 'MOBILE';
  if (isValidNRIC(identifier).valid) return 'NRIC';
  if (isValidUEN(identifier).valid) return 'UEN';
  return null;
}

module.exports = {
  isValidPayNowMobile,
  isValidUEN,
  isValidNRIC,
  detectPayNowIdType
};

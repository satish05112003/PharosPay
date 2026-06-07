function isValidRoutingNumber(routing) {
  if (!routing || typeof routing !== 'string') {
    return { valid: false, message: 'Routing number must be a non-empty string' };
  }
  const clean = routing.replace(/\D/g, '');
  if (clean.length !== 9) {
    return { valid: false, message: 'Routing number must be exactly 9 digits' };
  }

  // ABA Checksum validation
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights[i];
  }

  const valid = sum % 10 === 0;
  return {
    valid,
    message: valid ? 'Valid Routing Number' : 'Invalid Routing Number checksum'
  };
}

function isValidAccountNumber(account) {
  if (!account || typeof account !== 'string') {
    return { valid: false, message: 'Account number must be a non-empty string' };
  }
  const clean = account.replace(/\D/g, '');
  const regex = /^[0-9]{4,17}$/;
  const valid = regex.test(clean);
  return {
    valid,
    message: valid ? 'Valid Account Number' : 'Account number must be 4 to 17 digits'
  };
}

module.exports = {
  isValidRoutingNumber,
  isValidAccountNumber
};

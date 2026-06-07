function isValidUPIVPA(vpa) {
  if (!vpa || typeof vpa !== 'string') {
    return { valid: false, message: 'VPA must be a non-empty string' };
  }
  if (vpa.length > 256) {
    return { valid: false, message: 'VPA length exceeds 256 characters' };
  }
  const regex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
  const valid = regex.test(vpa);
  return {
    valid,
    message: valid ? 'Valid UPI VPA' : 'Invalid UPI VPA format'
  };
}

function isValidIFSC(ifsc) {
  if (!ifsc || typeof ifsc !== 'string') {
    return { valid: false, message: 'IFSC must be a non-empty string' };
  }
  const regex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const valid = regex.test(ifsc);
  return {
    valid,
    message: valid ? 'Valid IFSC' : 'Invalid IFSC format'
  };
}

function isValidAccountNumber(accountNumber) {
  if (!accountNumber || typeof accountNumber !== 'string') {
    return { valid: false, message: 'Account number must be a non-empty string' };
  }
  const regex = /^[0-9]{9,18}$/;
  const valid = regex.test(accountNumber);
  return {
    valid,
    message: valid ? 'Valid Account Number' : 'Account number must be 9 to 18 digits'
  };
}

function detectUPIRail(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  if (identifier.includes('@')) {
    return 'UPI';
  }
  // Check if identifier contains account number and IFSC separated by a slash or colon, e.g. "1234567890:SBIN0001234"
  if (identifier.includes('/') || identifier.includes(':')) {
    const parts = identifier.split(/[\/:]/);
    if (parts.length === 2) {
      const [acc, ifsc] = parts;
      if (isValidAccountNumber(acc).valid && isValidIFSC(ifsc).valid) {
        return 'IMPS';
      }
    }
  }
  return null;
}

function parseUPIQRString(qrString) {
  if (!qrString || typeof qrString !== 'string') return null;
  try {
    let urlStr = qrString;
    // Support intent:// scheme by extracting the upi:// query parameters
    if (urlStr.startsWith('intent://')) {
      const match = urlStr.match(/#Intent;scheme=(upi|intent);(.*?)end/);
      if (match) {
        urlStr = urlStr.replace('intent://', 'upi://').split('#Intent;')[0];
      }
    }

    if (!urlStr.startsWith('upi://')) return null;

    const url = new URL(urlStr);
    const params = new URLSearchParams(url.search);

    return {
      vpa: params.get('pa') || null,
      name: params.get('pn') || null,
      amount: params.get('am') || null,
      currency: params.get('cu') || null,
      txnRef: params.get('tr') || null,
      merchantCode: params.get('mc') || null
    };
  } catch (err) {
    console.error('Failed to parse UPI QR String:', err);
    return null;
  }
}

module.exports = {
  isValidUPIVPA,
  isValidIFSC,
  isValidAccountNumber,
  detectUPIRail,
  parseUPIQRString
};

function isValidCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return { valid: false, message: 'Invalid CPF input' };
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return { valid: false, message: 'CPF must be 11 digits' };
  if (/^(\d)\1{10}$/.test(cleanCpf)) return { valid: false, message: 'CPF cannot be all equal digits' };

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i), 10) * (10 - i);
  }
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cleanCpf.charAt(9), 10)) return { valid: false, message: 'Invalid CPF checksum' };

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i), 10) * (11 - i);
  }
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cleanCpf.charAt(10), 10)) return { valid: false, message: 'Invalid CPF checksum' };

  return { valid: true, message: 'Valid CPF' };
}

function isValidCNPJ(cnpj) {
  if (!cnpj || typeof cnpj !== 'string') return { valid: false, message: 'Invalid CNPJ input' };
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return { valid: false, message: 'CNPJ must be 14 digits' };
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return { valid: false, message: 'CNPJ cannot be all equal digits' };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj.charAt(i), 10) * w1[i];
  }
  let rem = sum % 11;
  let d1 = rem < 2 ? 0 : 11 - rem;
  if (d1 !== parseInt(cleanCnpj.charAt(12), 10)) return { valid: false, message: 'Invalid CNPJ checksum' };

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj.charAt(i), 10) * w2[i];
  }
  rem = sum % 11;
  let d2 = rem < 2 ? 0 : 11 - rem;
  if (d2 !== parseInt(cleanCnpj.charAt(13), 10)) return { valid: false, message: 'Invalid CNPJ checksum' };

  return { valid: true, message: 'Valid CNPJ' };
}

function isValidPixPhone(phone) {
  if (!phone || typeof phone !== 'string') return { valid: false, message: 'Invalid phone input' };
  // Expected format: +55 followed by 11 digits, total 14 chars
  const regex = /^\+55\d{11}$/;
  const valid = regex.test(phone);
  return {
    valid,
    message: valid ? 'Valid PIX Phone' : 'Phone must match +55 followed by 11 digits'
  };
}

function isValidPixEmail(email) {
  if (!email || typeof email !== 'string') return { valid: false, message: 'Invalid email input' };
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = regex.test(email);
  return {
    valid,
    message: valid ? 'Valid PIX Email' : 'Invalid email format'
  };
}

function isValidPixEVP(evp) {
  if (!evp || typeof evp !== 'string') return { valid: false, message: 'Invalid EVP input' };
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const valid = regex.test(evp);
  return {
    valid,
    message: valid ? 'Valid PIX EVP' : 'EVP key must be a valid UUID v4'
  };
}

function detectPixKeyType(key) {
  if (!key || typeof key !== 'string') return null;
  const clean = key.replace(/\D/g, '');
  if (clean.length === 11) return 'CPF';
  if (clean.length === 14) return 'CNPJ';
  if (key.startsWith('+55')) return 'PHONE';
  if (key.includes('@')) return 'EMAIL';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(key)) return 'EVP';
  return null;
}

function validatePixKey(key) {
  const type = detectPixKeyType(key);
  if (!type) {
    return { valid: false, type: null, message: 'Could not auto-detect PIX key type' };
  }
  let check;
  if (type === 'CPF') check = isValidCPF(key);
  else if (type === 'CNPJ') check = isValidCNPJ(key);
  else if (type === 'PHONE') check = isValidPixPhone(key);
  else if (type === 'EMAIL') check = isValidPixEmail(key);
  else if (type === 'EVP') check = isValidPixEVP(key);

  return {
    valid: check.valid,
    type,
    message: check.message
  };
}

module.exports = {
  isValidCPF,
  isValidCNPJ,
  isValidPixPhone,
  isValidPixEmail,
  isValidPixEVP,
  detectPixKeyType,
  validatePixKey
};

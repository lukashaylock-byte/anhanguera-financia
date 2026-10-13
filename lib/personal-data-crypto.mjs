import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

function getEncryptionKey() {
  const encoded = process.env.DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error('DATA_ENCRYPTION_KEY must be configured.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('DATA_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key.');
  }
  return key;
}

export function validatePersonalDataEncryptionKey() {
  getEncryptionKey();
}

/**
 * @param {string} plaintext
 * @param {string} context
 */
export function encryptPersonalData(plaintext, context) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), nonce);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1.${nonce.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

/**
 * @param {string} encrypted
 * @param {string} context
 */
export function decryptPersonalData(encrypted, context) {
  const [version, nonce, tag, ciphertext, ...extra] = encrypted.split('.');
  if (version !== 'v1' || !nonce || !tag || !ciphertext || extra.length) {
    throw new Error('Encrypted personal data has an unsupported format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(nonce, 'base64url'));
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * @param {'email' | 'cpf'} kind
 * @param {string} value
 */
export function hashPersonalData(kind, value) {
  const lookupKey = createHmac('sha256', getEncryptionKey())
    .update('anhanguera-financia:lookup-key:v1')
    .digest();
  const normalized = kind === 'email' ? value.trim().toLowerCase() : value.replace(/\D/g, '');
  return createHmac('sha256', lookupKey).update(`${kind}:${normalized}`).digest('hex');
}

import { decryptPersonalData, encryptPersonalData, hashPersonalData } from './personal-data-crypto.mjs';

/**
 * @param {string} value
 */
export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

/**
 * @param {string} value
 */
export function emailLookupHash(value) {
  return hashPersonalData('email', normalizeEmail(value));
}

/**
 * @param {string} value
 */
export function cpfLookupHash(value) {
  return hashPersonalData('cpf', value);
}

/**
 * @param {{ id: string; fullName: string | null; fullNameEncrypted: string | null; email: string | null; emailEncrypted: string | null }} user
 */
export function readUserProfile(user) {
  const fullName = user.fullNameEncrypted
    ? decryptPersonalData(user.fullNameEncrypted, `user:${user.id}:fullName`)
    : user.fullName;
  const email = user.emailEncrypted
    ? decryptPersonalData(user.emailEncrypted, `user:${user.id}:email`)
    : user.email;
  if (!fullName || !email) throw new Error('The user profile is incomplete.');
  return { fullName, email };
}

/**
 * @param {{ id: string; fullName: string | null; fullNameEncrypted: string | null; email: string | null; emailEncrypted: string | null; emailLookupHash: string | null; cpf: string | null; cpfEncrypted: string | null; cpfLookupHash: string | null; birthDate: Date | null; birthDateEncrypted: string | null }} user
 */
export function readUserPersonalData(user) {
  const fullName = user.fullNameEncrypted
    ? decryptPersonalData(user.fullNameEncrypted, `user:${user.id}:fullName`)
    : user.fullName;
  const email = user.emailEncrypted
    ? decryptPersonalData(user.emailEncrypted, `user:${user.id}:email`)
    : user.email;
  const cpf = user.cpfEncrypted
    ? decryptPersonalData(user.cpfEncrypted, `user:${user.id}:cpf`)
    : user.cpf;
  const birthDate = user.birthDateEncrypted
    ? decryptPersonalData(user.birthDateEncrypted, `user:${user.id}:birthDate`)
    : user.birthDate?.toISOString();
  if (!fullName || !email || !cpf || !birthDate) throw new Error('The user personal data is incomplete.');
  return { fullName, email, cpf, birthDate };
}

/**
 * @param {string} id
 * @param {{ fullName: string; email: string; cpf: string; birthDate: Date | string }} values
 */
export function encryptUserPersonalData(id, values) {
  const birthDate = values.birthDate instanceof Date ? values.birthDate.toISOString() : values.birthDate;
  return {
    fullName: null,
    fullNameEncrypted: encryptPersonalData(values.fullName, `user:${id}:fullName`),
    email: null,
    emailEncrypted: encryptPersonalData(normalizeEmail(values.email), `user:${id}:email`),
    emailLookupHash: emailLookupHash(values.email),
    cpf: null,
    cpfEncrypted: encryptPersonalData(values.cpf, `user:${id}:cpf`),
    cpfLookupHash: cpfLookupHash(values.cpf),
    birthDate: null,
    birthDateEncrypted: encryptPersonalData(birthDate, `user:${id}:birthDate`),
  };
}

/**
 * @param {{ id: string; email: string | null; emailEncrypted: string | null; emailLookupHash: string | null }} invitation
 */
export function readInvitationEmail(invitation) {
  const email = invitation.emailEncrypted
    ? decryptPersonalData(invitation.emailEncrypted, `invitation:${invitation.emailLookupHash}:email`)
    : invitation.email;
  if (!email) throw new Error('The invitation email is missing.');
  return normalizeEmail(email);
}

/**
 * @param {string} emailHash
 * @param {string} email
 */
export function encryptInvitationEmail(emailHash, email) {
  const normalizedEmail = normalizeEmail(email);
  return {
    email: null,
    emailEncrypted: encryptPersonalData(normalizedEmail, `invitation:${emailHash}:email`),
    emailLookupHash: emailHash,
  };
}

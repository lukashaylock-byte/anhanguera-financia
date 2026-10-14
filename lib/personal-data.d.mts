type UserPersonalData = {
  id: string;
  fullName: string | null;
  fullNameEncrypted: string | null;
  email: string | null;
  emailEncrypted: string | null;
  emailLookupHash: string | null;
  cpf: string | null;
  cpfEncrypted: string | null;
  cpfLookupHash: string | null;
  birthDate: Date | null;
  birthDateEncrypted: string | null;
};

type InvitationPersonalData = {
  id?: string;
  email: string | null;
  emailEncrypted: string | null;
  emailLookupHash: string | null;
};

export function normalizeEmail(value: string): string;
export function emailLookupHash(value: string): string;
export function cpfLookupHash(value: string): string;
export function readUserProfile(user: Pick<UserPersonalData, 'id' | 'fullName' | 'fullNameEncrypted' | 'email' | 'emailEncrypted'>): { fullName: string; email: string };
export function readUserPersonalData(user: UserPersonalData): { fullName: string; email: string; cpf: string; birthDate: string };
export function encryptUserPersonalData(id: string, values: { fullName: string; email: string; cpf: string; birthDate: Date | string }): Pick<UserPersonalData, 'fullName' | 'fullNameEncrypted' | 'email' | 'emailEncrypted' | 'emailLookupHash' | 'cpf' | 'cpfEncrypted' | 'cpfLookupHash' | 'birthDate' | 'birthDateEncrypted'>;
export function readInvitationEmail(invitation: InvitationPersonalData): string;
export function encryptInvitationEmail(emailHash: string, email: string): Pick<InvitationPersonalData, 'email' | 'emailEncrypted' | 'emailLookupHash'>;

import { emailLookupHash, encryptInvitationEmail, encryptUserPersonalData, readInvitationEmail, readUserPersonalData } from './personal-data.mjs';

/**
 * @param {import('@prisma/client').PrismaClient} client
 * @param {{ clearPlaintext?: boolean }} [options]
 */
export async function backfillPersonalData(client, options = {}) {
  const clearPlaintext = options.clearPlaintext === true;
  let userCount = 0;
  let invitationCount = 0;

  while (true) {
    let cursor = '';
    let updatedThisPass = 0;
    while (true) {
      const users = await client.user.findMany({
        where: {
          id: { gt: cursor },
          OR: clearPlaintext
            ? [
                { fullNameEncrypted: null },
                { emailEncrypted: null },
                { emailLookupHash: null },
                { cpfEncrypted: null },
                { cpfLookupHash: null },
                { birthDateEncrypted: null },
                { fullName: { not: null } },
                { email: { not: null } },
                { cpf: { not: null } },
                { birthDate: { not: null } },
              ]
            : [
                { fullNameEncrypted: null },
                { emailEncrypted: null },
                { emailLookupHash: null },
                { cpfEncrypted: null },
                { cpfLookupHash: null },
                { birthDateEncrypted: null },
              ],
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: {
          id: true,
          fullName: true,
          fullNameEncrypted: true,
          email: true,
          emailEncrypted: true,
          emailLookupHash: true,
          cpf: true,
          cpfEncrypted: true,
          cpfLookupHash: true,
          birthDate: true,
          birthDateEncrypted: true,
        },
      });
      if (!users.length) break;
      cursor = users[users.length - 1].id;
      const updates = users.map((user) => {
        const personalData = readUserPersonalData(user);
        const encrypted = encryptUserPersonalData(user.id, personalData);
        return client.user.update({
          where: { id: user.id },
          data: clearPlaintext ? encrypted : {
            ...encrypted,
            fullName: user.fullName,
            email: user.email,
            cpf: user.cpf,
            birthDate: user.birthDate,
          },
        });
      });
      await client.$transaction(updates);
      userCount += users.length;
      updatedThisPass += users.length;
    }
    if (!clearPlaintext || updatedThisPass === 0) break;
  }

  while (true) {
    let cursor = '';
    let updatedThisPass = 0;
    while (true) {
      const invitations = await client.invitation.findMany({
        where: {
          id: { gt: cursor },
          OR: clearPlaintext
            ? [
                { emailEncrypted: null },
                { emailLookupHash: null },
                { email: { not: null } },
              ]
            : [{ emailEncrypted: null }, { emailLookupHash: null }],
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: { id: true, email: true, emailEncrypted: true, emailLookupHash: true },
      });
      if (!invitations.length) break;
      cursor = invitations[invitations.length - 1].id;
      const updates = invitations.map((invitation) => {
        const email = readInvitationEmail(invitation);
        const encrypted = encryptInvitationEmail(emailLookupHash(email), email);
        return client.invitation.update({
          where: { id: invitation.id },
          data: clearPlaintext ? encrypted : { ...encrypted, email: invitation.email },
        });
      });
      await client.$transaction(updates);
      invitationCount += invitations.length;
      updatedThisPass += invitations.length;
    }
    if (!clearPlaintext || updatedThisPass === 0) break;
  }

  return { users: userCount, invitations: invitationCount };
}

import bcrypt from 'bcrypt';

export interface AdminCredentials {
  email: string | null;
  passwordHash: string | null;
}

export const getAdminCredentials = (): AdminCredentials => {
  return {
    email: process.env.ADMIN_EMAIL ?? null,
    passwordHash: process.env.ADMIN_PASSWORD_HASH ?? null,
  };
};

export const verifyAdminCredentials = async (
  identifier: string | undefined,
  password: string | undefined
): Promise<string | null> => {
  const { email, passwordHash } = getAdminCredentials();

  if (!email || !passwordHash || typeof identifier !== 'string' || typeof password !== 'string') {
    return null;
  }

  if (identifier !== email) {
    return null;
  }

  const matches = await bcrypt.compare(password, passwordHash);
  return matches ? email : null;
};
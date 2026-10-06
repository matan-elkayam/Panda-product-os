import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords';

describe('password hashing', () => {
  it('verifies the correct password and rejects a wrong one', async () => {
    const password = 'correct horse battery staple';
    const encoded = await hashPassword(password);

    expect(encoded.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password-value', encoded)).resolves.toBe(false);
  });

  it('uses a unique salt for every password hash', async () => {
    const password = 'same password, different salts';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
  });
});

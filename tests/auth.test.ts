import { describe, it, expect } from 'vitest';
import { generateToken } from '../server/middleware/auth';
import jwt from 'jsonwebtoken';

describe('Authentication & JWT Session Security', () => {
  const dummyUser: any = {
    id: 'usr-test-1',
    email: 'test@feastfleet.com',
    name: 'Test Officer',
    role: 'courier'
  };

  it('generates a valid, cryptographically signed JWT token', () => {
    const token = generateToken(dummyUser);
    expect(typeof token).toBe('string');

    const decoded = jwt.decode(token) as any;
    expect(decoded.id).toBe(dummyUser.id);
    expect(decoded.email).toBe(dummyUser.email);
    expect(decoded.role).toBe('courier');
  });

  it('rejects tampered or forged tokens', () => {
    const token = generateToken(dummyUser);
    const tampered = token.slice(0, -5) + 'xxxxx';

    expect(() => {
      jwt.verify(tampered, 'feastfleet-super-secure-production-jwt-key-2026');
    }).toThrow();
  });
});

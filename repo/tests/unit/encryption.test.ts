import { encrypt, decrypt, encryptField, decryptField } from '../../src/config/encryption';

describe('Encryption (AES-256-GCM)', () => {
  it('encrypt → decrypt roundtrip returns original plaintext', () => {
    const plaintext = 'hello world';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('roundtrip works with unicode characters', () => {
    const plaintext = 'Hl, Wlt! 12345';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('roundtrip works with empty string', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  it('two encryptions of the same plaintext produce different ciphertext (random IV)', () => {
    const plaintext = 'deterministic-test';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('tampered ciphertext throws', () => {
    const ciphertext = encrypt('secret');
    // Flip a byte in the encrypted payload area
    ciphertext[ciphertext.length - 1] ^= 0xff;
    expect(() => decrypt(ciphertext)).toThrow();
  });
});

describe('encryptField / decryptField (nullable wrappers)', () => {
  it('encryptField(null) returns null', () => {
    expect(encryptField(null)).toBeNull();
  });

  it('encryptField(undefined) returns null', () => {
    expect(encryptField(undefined)).toBeNull();
  });

  it('encryptField with value returns a Buffer', () => {
    const result = encryptField('test@example.com');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('decryptField(null) returns null', () => {
    expect(decryptField(null)).toBeNull();
  });

  it('decryptField(undefined) returns null', () => {
    expect(decryptField(undefined)).toBeNull();
  });

  it('encryptField → decryptField roundtrip', () => {
    const email = 'user@example.com';
    const encrypted = encryptField(email);
    expect(encrypted).not.toBeNull();
    expect(decryptField(encrypted!)).toBe(email);
  });
});

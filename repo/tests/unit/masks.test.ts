import { maskUsername, maskEmail } from '../../src/utils/masks';

describe('maskUsername', () => {
  it('single character → first char + ***', () => {
    expect(maskUsername('a')).toBe('a***');
  });

  it('two characters → first char + ***', () => {
    expect(maskUsername('ab')).toBe('a***');
  });

  it('three characters → first + *** + last', () => {
    expect(maskUsername('abc')).toBe('a***c');
  });

  it('long username → first + *** + last', () => {
    expect(maskUsername('johndoe')).toBe('j***e');
  });
});

describe('maskEmail', () => {
  it('standard email → masked local and domain', () => {
    const masked = maskEmail('john@example.com');
    // local: j***n, domain: e***.com
    expect(masked).toBe('j***n@e***.com');
  });

  it('short local part (2 chars) → first + ***', () => {
    const masked = maskEmail('ab@example.com');
    expect(masked).toBe('a***@e***.com');
  });

  it('single char local part → first + ***', () => {
    const masked = maskEmail('a@example.com');
    expect(masked).toBe('a***@e***.com');
  });

  it('no @ sign → fallback mask', () => {
    expect(maskEmail('notanemail')).toBe('***@***');
  });

  it('multi-part domain preserves TLD structure', () => {
    const masked = maskEmail('user@mail.example.co.uk');
    expect(masked).toContain('@');
    expect(masked).toContain('.co.uk');
  });

  it('short domain (2 chars) → first + ***', () => {
    const masked = maskEmail('user@ab.org');
    expect(masked).toBe('u***r@a***.org');
  });
});

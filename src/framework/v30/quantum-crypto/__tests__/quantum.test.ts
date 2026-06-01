import { PolymorphicEngine } from '../PolymorphicEngine';

describe('PolymorphicEngine', () => {
  let engine: PolymorphicEngine;

  beforeEach(() => {
    engine = new PolymorphicEngine();
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'Super secret quantum data';
    const ciphertext = engine.encrypt(plaintext);
    expect(ciphertext).toBeDefined();
    expect(ciphertext).not.toEqual(plaintext);
    expect(ciphertext.startsWith('v1:')).toBe(true);

    const decrypted = engine.decrypt(ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it('should correctly handle rotation', () => {
    const plaintext1 = 'Message 1';
    const ciphertext1 = engine.encrypt(plaintext1);

    const oldId = engine.getCurrentContextId();

    engine.rotate();
    const newId = engine.getCurrentContextId();
    expect(oldId).not.toEqual(newId);

    const plaintext2 = 'Message 2';
    const ciphertext2 = engine.encrypt(plaintext2);

    expect(engine.decrypt(ciphertext1)).toEqual(plaintext1);
    expect(engine.decrypt(ciphertext2)).toEqual(plaintext2);
  });

  it('should generate and validate DNA Sequence Keys', () => {
    const key = engine.generateDNASequenceKey(256);
    expect(key).toBeDefined();
    expect(key.sequence.length).toEqual(256);
    expect(key.entropyScore).toBeGreaterThan(0);

    const isValid = engine.validateDNASequenceKey(key);
    expect(isValid).toBe(true);

    const defaultKey = engine.generateDNASequenceKey();
    expect(defaultKey.sequence.length).toEqual(256);
  });

  it('should reject invalid DNA Sequence Keys', () => {
    expect(engine.validateDNASequenceKey(null as any)).toBe(false);
    expect(engine.validateDNASequenceKey({} as any)).toBe(false);

    const invalidBaseKey = {
      sequence: 'INVALID_BASES',
      entropyScore: 2.0,
      generatedAt: Date.now(),
    };
    expect(engine.validateDNASequenceKey(invalidBaseKey)).toBe(false);

    const expiredKey = {
      sequence: 'ACGTACGT',
      entropyScore: 2.0,
      generatedAt: Date.now() - 4000 * 1000, // > 1 hour ago
    };
    expect(engine.validateDNASequenceKey(expiredKey)).toBe(false);

    const lowEntropyKey = {
      sequence: 'AAAAAAAA',
      entropyScore: 0.0,
      generatedAt: Date.now(),
    };
    expect(engine.validateDNASequenceKey(lowEntropyKey)).toBe(false);
  });

  it('should regenerate DNA key on rotate if present', () => {
    engine.generateDNASequenceKey(128);
    const originalSequence = engine.getActiveDNAKey()?.sequence;

    engine.rotate();

    const newSequence = engine.getActiveDNAKey()?.sequence;
    expect(newSequence).toBeDefined();
    expect(newSequence).not.toEqual(originalSequence);
  });

  it('should throw on invalid payload format', () => {
    expect(() => engine.decrypt('invalid_payload')).toThrow('Invalid polymorphic payload format');
    expect(() => engine.decrypt('v2:id:alg:iv:auth:cipher')).toThrow(
      'Unsupported payload version: v2'
    );
  });

  it('should throw on missing key', () => {
    expect(() => engine.decrypt('v1:unknown_id:aes-256-gcm:iv:auth:cipher')).toThrow(
      'Key not found in temporal store'
    );
  });

  it('should throw on algorithm mismatch', () => {
    const ciphertext = engine.encrypt('test');
    const parts = ciphertext.split(':');
    const wrongAlg = parts[2] === 'aes-256-gcm' ? 'aes-256-cbc' : 'aes-256-gcm';
    parts[2] = wrongAlg;
    const tampered = parts.join(':');
    expect(() => engine.decrypt(tampered)).toThrow('Algorithm mismatch in payload');
  });

  it('should rotate continuously to cover all algorithms and decrypt successfully', () => {
    const algorithmsSeen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      engine.rotate();
      const pt = 'test_payload_' + i;
      const ct = engine.encrypt(pt);

      const decrypted = engine.decrypt(ct);
      expect(decrypted).toEqual(pt);

      const alg = ct.split(':')[2];
      algorithmsSeen.add(alg);
    }
    expect(algorithmsSeen.size).toBe(2);
    expect(algorithmsSeen.has('aes-256-gcm')).toBe(true);
    expect(algorithmsSeen.has('aes-256-cbc')).toBe(true);
  });

  it('should handle getActiveDNAKey when no key has been generated', () => {
    expect(engine.getActiveDNAKey()).toBeNull();
  });
});

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
});

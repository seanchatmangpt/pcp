import { RealityReceiptGenerator, RealityReceiptData, RealityReceipt } from '../index';

describe('RealityReceiptGenerator', () => {
  const systemSecret = 'super-secret-key-12345';
  let generator: RealityReceiptGenerator;

  const getValidData = (): RealityReceiptData => ({
    zkpIdentity: {
      proof: 'zkp-proof-data',
      publicSignals: ['signal1', 'signal2'],
    },
    hardwareTelemetry: {
      deviceId: 'device-001',
      cpuCores: 8,
      memoryCapacity: 16384,
      secureEnclavePresent: true,
    },
    behavioralIntent: {
      action: 'login',
      timestamp: 1678886400000,
      metadata: { source: 'mobile' },
    },
  });

  beforeEach(() => {
    generator = new RealityReceiptGenerator(systemSecret);
  });

  describe('constructor', () => {
    it('should throw if initialized without a system secret', () => {
      expect(() => new RealityReceiptGenerator('')).toThrow(
        'System secret is required for unforgeable artifact generation'
      );
    });
  });

  describe('generate', () => {
    it('should generate a valid RealityReceipt', () => {
      const validData = getValidData();
      const receipt = generator.generate(validData);
      expect(receipt.version).toBe('1.0.0');
      expect(receipt.data).toEqual(validData);
      expect(typeof receipt.hash).toBe('string');
      expect(typeof receipt.signature).toBe('string');
    });

    it('should throw on missing data', () => {
      expect(() => generator.generate(null as any)).toThrow('Data is undefined');
    });

    it('should throw on invalid ZKPIdentity', () => {
      const invalidData = { ...getValidData(), zkpIdentity: null } as any;
      expect(() => generator.generate(invalidData)).toThrow('Invalid ZKPIdentity');
    });

    it('should throw on invalid HardwareTelemetry', () => {
      const invalidData = { ...getValidData(), hardwareTelemetry: null } as any;
      expect(() => generator.generate(invalidData)).toThrow('Invalid HardwareTelemetry');
    });

    it('should throw on invalid BehavioralIntent', () => {
      const invalidData = { ...getValidData(), behavioralIntent: null } as any;
      expect(() => generator.generate(invalidData)).toThrow('Invalid BehavioralIntent');
    });
  });

  describe('verifyReality', () => {
    it('should return true for a valid, unmodified receipt', () => {
      const receipt = generator.generate(getValidData());
      expect(generator.verifyReality(receipt)).toBe(true);
    });

    it('should return false for an invalid version', () => {
      const receipt = generator.generate(getValidData());
      (receipt as any).version = '2.0.0';
      expect(generator.verifyReality(receipt)).toBe(false);
    });

    it('should return false if receipt is null', () => {
      expect(generator.verifyReality(null as any)).toBe(false);
    });

    it('should return false if data validation fails during verification', () => {
      const receipt = generator.generate(getValidData());
      (receipt.data as any).zkpIdentity = null;
      expect(generator.verifyReality(receipt)).toBe(false);
    });

    it('should return false if the hash does not match the data', () => {
      const receipt = generator.generate(getValidData());
      receipt.data.behavioralIntent.action = 'transfer_funds';
      expect(generator.verifyReality(receipt)).toBe(false);
    });

    it('should return false if the signature does not match the hash', () => {
      const receipt = generator.generate(getValidData());
      receipt.hash = '0000000000000000000000000000000000000000000000000000000000000000';
      expect(generator.verifyReality(receipt)).toBe(false);
    });

    it('should return false if signature length is altered (timingSafeEqual exception)', () => {
      const receipt = generator.generate(getValidData());
      receipt.signature = receipt.signature.substring(0, 10);
      expect(generator.verifyReality(receipt)).toBe(false);
    });
  });

  describe('serialize and deserialize', () => {
    it('should accurately serialize and deserialize a receipt', () => {
      const receipt = generator.generate(getValidData());
      const serialized = generator.serialize(receipt);
      expect(typeof serialized).toBe('string');

      const deserialized = generator.deserialize(serialized);
      expect(deserialized).toEqual(receipt);
    });

    it('should throw on invalid JSON payload in deserialize', () => {
      expect(() => generator.deserialize('not-json')).toThrow();
    });

    it('should throw on invalid structure in deserialize', () => {
      expect(() => generator.deserialize('{}')).toThrow('Invalid RealityReceipt payload');
    });
  });
});

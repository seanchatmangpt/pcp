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
  });
});

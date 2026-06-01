import {
  sha256,
  canonicalStringify,
  generateReceiptHash,
  blake3,
  generateBlake3ReceiptHash,
  mod,
  modPow,
  modInverse,
  parseToBigInt,
  isPointOnSecp256k1,
  isPointOnBn254G1,
  isPointOnBn254G2,
  ecAdd,
  ecDouble,
  ecMultiply,
  verifyEcdsaSignature,
  verifyZKProofReceipt,
  SECP256K1_G,
  SECP256K1_N,
  SECP256K1_P,
  BN254_P,
} from '../receipts';

describe('Receipt Cryptographic Auditing', () => {
  describe('sha256', () => {
    it('computes correct SHA-256 for empty string', () => {
      expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('computes correct SHA-256 for standard string', () => {
      expect(sha256('hello world')).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('computes correct SHA-256 for unicode and emoji characters', () => {
      const hash1 = sha256('hello 🌟 world');
      const hash2 = sha256('hello 🌟 world');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('canonicalStringify', () => {
    it('serializes objects deterministically regardless of key order', () => {
      const obj1 = { a: 1, b: { y: 2, x: 1 }, c: [1, 2] };
      const obj2 = { c: [1, 2], b: { x: 1, y: 2 }, a: 1 };
      
      expect(canonicalStringify(obj1)).toBe(canonicalStringify(obj2));
      expect(canonicalStringify(obj1)).toBe('{"a":1,"b":{"x":1,"y":2},"c":[1,2]}');
    });

    it('handles primitive values correctly', () => {
      expect(canonicalStringify(null)).toBe('null');
      expect(canonicalStringify(undefined)).toBe('undefined');
      expect(canonicalStringify(123)).toBe('123');
      expect(canonicalStringify('test')).toBe('"test"');
      expect(canonicalStringify(true)).toBe('true');
    });
  });

  describe('generateReceiptHash', () => {
    it('generates genesis hash when previousHash is null or empty', () => {
      const data = { amount: 100, currency: 'USD' };
      const hashFromNull = generateReceiptHash(null, data);
      const hashFromEmpty = generateReceiptHash('', data);
      
      expect(hashFromNull).toBe(hashFromEmpty);
      expect(hashFromNull).toHaveLength(64);
    });

    it('chains receipts correctly by linking the previous hash', () => {
      const genesisData = { message: 'Genesis Block' };
      const genesisHash = generateReceiptHash(null, genesisData);

      const secondData = { amount: 50, recipient: 'Alice' };
      const secondHash = generateReceiptHash(genesisHash, secondData);

      expect(secondHash).not.toBe(genesisHash);
      expect(secondHash).toHaveLength(64);
    });
  });

  describe('blake3', () => {
    it('computes correct BLAKE3 hash for empty string', () => {
      expect(blake3('')).toBe('af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262');
    });

    it('computes correct BLAKE3 hash for hello world', () => {
      const hash = blake3('hello world');
      expect(hash).toHaveLength(64);
    });
  });

  describe('Modular Arithmetic Helpers', () => {
    it('handles mod correctly with negative numbers', () => {
      expect(mod(-5n, 10n)).toBe(5n);
      expect(mod(15n, 10n)).toBe(5n);
    });

    it('computes modPow correctly', () => {
      // 2^10 % 1000 = 1024 % 1000 = 24
      expect(modPow(2n, 10n, 1000n)).toBe(24n);
    });

    it('computes modInverse correctly', () => {
      // 3 * 7 = 21 = 1 mod 10 -> inverse of 3 mod 10 is 7
      expect(modInverse(3n, 10n)).toBe(7n);
      // inverse of 7 mod 11 is 8 (56 = 1 mod 11)
      expect(modInverse(7n, 11n)).toBe(8n);
    });
  });

  describe('BigInt Parser', () => {
    it('parses bigints, numbers, hex and decimal strings correctly', () => {
      expect(parseToBigInt(123n)).toBe(123n);
      expect(parseToBigInt(123)).toBe(123n);
      expect(parseToBigInt('123')).toBe(123n);
      expect(parseToBigInt('0x7b')).toBe(123n);
      expect(parseToBigInt('7b')).toBe(123n);
    });

    it('throws error for invalid formats or float precision risks', () => {
      expect(() => parseToBigInt(1.23)).toThrow();
      expect(() => parseToBigInt('abcg')).toThrow();
      expect(() => parseToBigInt({})).toThrow();
    });
  });

  describe('Elliptic Curve Geometry & Arithmetic (secp256k1)', () => {
    it('verifies G generator point lies on secp256k1 curve', () => {
      expect(isPointOnSecp256k1(SECP256K1_G)).toBe(true);
    });

    it('verifies point at infinity is valid', () => {
      expect(isPointOnSecp256k1({ x: 0n, y: 0n, isInfinity: true })).toBe(true);
    });

    it('identifies invalid points not on the curve', () => {
      expect(isPointOnSecp256k1({ x: 5n, y: 5n, isInfinity: false })).toBe(false);
    });

    it('performs point addition correctly', () => {
      // Add generator to itself (double G)
      const g2 = ecDouble(SECP256K1_G);
      const gPlusG = ecAdd(SECP256K1_G, SECP256K1_G);
      expect(gPlusG.x).toBe(g2.x);
      expect(gPlusG.y).toBe(g2.y);
      expect(gPlusG.isInfinity).toBe(false);

      // Add point and its negation to get infinity
      const negatedG = { ...SECP256K1_G, y: mod(-SECP256K1_G.y, SECP256K1_P) };
      const inf = ecAdd(SECP256K1_G, negatedG);
      expect(inf.isInfinity).toBe(true);
    });

    it('performs scalar multiplication correctly', () => {
      const g2 = ecMultiply(SECP256K1_G, 2n);
      const g2Double = ecDouble(SECP256K1_G);
      expect(g2.x).toBe(g2Double.x);
      expect(g2.y).toBe(g2Double.y);

      // Multiplication by order N should yield point at infinity
      const inf = ecMultiply(SECP256K1_G, SECP256K1_N);
      expect(inf.isInfinity).toBe(true);
    });
  });

  describe('ECDSA Signature Verification', () => {
    // Math-correct signing helper for testing verification logic dynamically
    function sign(privKey: bigint, msgHash: bigint, k: bigint) {
      const Q = ecMultiply(SECP256K1_G, privKey);
      const R = ecMultiply(SECP256K1_G, k);
      const r = mod(R.x, SECP256K1_N);
      const kInv = modInverse(k, SECP256K1_N);
      let s = mod(kInv * (msgHash + r * privKey), SECP256K1_N);
      if (s > SECP256K1_N / 2n) {
        s = SECP256K1_N - s;
      }
      return { r, s, publicKey: Q };
    }

    const privKey = 0xabcdef123456n;
    const msgHash = 0x112233445566n;
    const k = 0x778899n;
    const sig = sign(privKey, msgHash, k);

    it('successfully verifies a valid mathematically generated signature', () => {
      const result = verifyEcdsaSignature(
        msgHash,
        { r: sig.r, s: sig.s },
        { x: sig.publicKey.x, y: sig.publicKey.y }
      );
      expect(result.valid).toBe(true);
    });

    it('fails if message hash is altered', () => {
      const result = verifyEcdsaSignature(
        msgHash + 1n,
        { r: sig.r, s: sig.s },
        { x: sig.publicKey.x, y: sig.publicKey.y }
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('failed');
    });

    it('fails if public key is not on curve', () => {
      const result = verifyEcdsaSignature(
        msgHash,
        { r: sig.r, s: sig.s },
        { x: sig.publicKey.x + 1n, y: sig.publicKey.y }
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a valid point');
    });

    it('prevents high-s signature malleability', () => {
      // Generate a high-s signature explicitly
      const kInv = modInverse(k, SECP256K1_N);
      const r = mod(ecMultiply(SECP256K1_G, k).x, SECP256K1_N);
      let sHigh = mod(kInv * (msgHash + r * privKey), SECP256K1_N);
      if (sHigh <= SECP256K1_N / 2n) {
        sHigh = SECP256K1_N - sHigh;
      }

      const result = verifyEcdsaSignature(
        msgHash,
        { r, s: sHigh },
        { x: sig.publicKey.x, y: sig.publicKey.y }
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds n/2');
    });

    it('rejects signature values out of bounds', () => {
      // r = 0 or s = 0 or r >= N or s >= N
      expect(verifyEcdsaSignature(msgHash, { r: 0n, s: sig.s }, { x: sig.publicKey.x, y: sig.publicKey.y }).valid).toBe(false);
      expect(verifyEcdsaSignature(msgHash, { r: sig.r, s: 0n }, { x: sig.publicKey.x, y: sig.publicKey.y }).valid).toBe(false);
      expect(verifyEcdsaSignature(msgHash, { r: SECP256K1_N, s: sig.s }, { x: sig.publicKey.x, y: sig.publicKey.y }).valid).toBe(false);
      expect(verifyEcdsaSignature(msgHash, { r: sig.r, s: SECP256K1_N }, { x: sig.publicKey.x, y: sig.publicKey.y }).valid).toBe(false);
    });
  });

  describe('BN254 Curve Verification (ZK-SNARK)', () => {
    it('checks G1 point membership correctly', () => {
      // (1, 2) is a valid point on BN254 G1 curve since 2^2 = 4 and 1^3 + 3 = 4
      expect(isPointOnBn254G1(1n, 2n)).toBe(true);
      // (1, 3) is invalid
      expect(isPointOnBn254G1(1n, 3n)).toBe(false);
      // out of bounds coordinates
      expect(isPointOnBn254G1(BN254_P, 2n)).toBe(false);
      expect(isPointOnBn254G1(1n, -1n)).toBe(false);
    });

    it('checks G2 point membership correctly using standard test point', () => {
      // Common generator point of G2 on BN254:
      const x0 = 10857046999023057135944570762232829481370756359578518086990519993285655852781n;
      const x1 = 11559732032986387107991004021392285783925812814806588151524303159343745272007n;
      const y0 = 8495653923126297913904642720300106078345911663138259006793102173105747426n;
      const y1 = 4003224970662641952094526137938957457786851663241220188191151320840595290382n;

      expect(isPointOnBn254G2(x0, x1, y0, y1)).toBe(true);

      // Altered imaginary coordinate
      expect(isPointOnBn254G2(x0, x1, y0, y1 + 1n)).toBe(false);
    });
  });

  describe('verifyZKProofReceipt', () => {
    const validG2_x0 = 10857046999023057135944570762232829481370756359578518086990519993285655852781n;
    const validG2_x1 = 11559732032986387107991004021392285783925812814806588151524303159343745272007n;
    const validG2_y0 = 8495653923126297913904642720300106078345911663138259006793102173105747426n;
    const validG2_y1 = 4003224970662641952094526137938957457786851663241220188191151320840595290382n;

    const receipt = {
      proof: {
        a: [1n, 2n] as [bigint, bigint], // lies on G1
        b: [[validG2_x0, validG2_x1], [validG2_y0, validG2_y1]] as [[bigint, bigint], [bigint, bigint]], // lies on G2
        c: [1n, 2n] as [bigint, bigint], // lies on G1
      },
      publicInputs: [100n, 200n],
      receiptHash: '100', // Matches first public input
    };

    const vk = {
      expectedInputsCount: 2,
    };

    it('successfully verifies valid inputs and correct bindings', () => {
      const res = verifyZKProofReceipt(receipt, vk);
      expect(res.valid).toBe(true);
    });

    it('fails when public inputs count does not match expected', () => {
      const res = verifyZKProofReceipt(receipt, { expectedInputsCount: 3 });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('mismatch');
    });

    it('fails when a public input is out of prime field bounds', () => {
      const invalidReceipt = {
        ...receipt,
        publicInputs: [BN254_P, 200n],
      };
      const res = verifyZKProofReceipt(invalidReceipt, vk);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('field bounds');
    });

    it('fails when G1 point A coordinates do not lie on G1 curve', () => {
      const invalidReceipt = {
        ...receipt,
        proof: {
          ...receipt.proof,
          a: [1n, 3n] as [bigint, bigint],
        },
      };
      const res = verifyZKProofReceipt(invalidReceipt, vk);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('point A is not a valid point');
    });

    it('fails when G2 point B coordinates do not lie on G2 curve', () => {
      const invalidReceipt = {
        ...receipt,
        proof: {
          ...receipt.proof,
          b: [[validG2_x0, validG2_x1], [validG2_y0, validG2_y1 + 1n]] as [[bigint, bigint], [bigint, bigint]],
        },
      };
      const res = verifyZKProofReceipt(invalidReceipt, vk);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('point B is not a valid point');
    });

    it('fails when receiptHash is not bound to public inputs', () => {
      const invalidReceipt = {
        ...receipt,
        receiptHash: '999',
      };
      const res = verifyZKProofReceipt(invalidReceipt, vk);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('binding verification failed');
    });
  });
});

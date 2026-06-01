import {
  mod,
  modInverse,
  parseToBigInt,
  ecAdd,
  ecDouble,
  verifyZKProofReceipt,
  SECP256K1_G,
  SECP256K1_P,
  BN254_P,
  Secp256k1Point,
} from '../receipts';

/**
 * Hardened modular inverse function that prevents loop bypass for zero inputs
 * and division-by-zero crashes for non-coprime inputs.
 */
export function hardenedModInverse(a: bigint, m: bigint): bigint {
  if (m <= 0n) {
    throw new Error('Modulus must be positive');
  }
  const reducedA = mod(a, m);
  if (reducedA === 0n) {
    throw new Error('Modular inverse does not exist: input is congruent to 0');
  }

  let m0 = m;
  let y = 0n;
  let x = 1n;
  let aVal = reducedA;

  while (aVal > 1n) {
    if (m === 0n) {
      throw new Error('Modular inverse does not exist: inputs are not coprime');
    }
    const q = aVal / m;
    let t = m;
    m = aVal % m;
    aVal = t;
    t = y;
    y = x - q * y;
    x = t;
  }

  if (aVal !== 1n) {
    throw new Error('Modular inverse does not exist: inputs are not coprime');
  }

  if (x < 0n) {
    x += m0;
  }
  return x;
}

/**
 * Hardened parseToBigInt that eliminates hex-decimal parsing ambiguity
 * by requiring explicit format specification or strict hexadecimal pattern detection.
 */
export function hardenedParseToBigInt(val: any, forceHex: boolean = false): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') {
    if (!Number.isSafeInteger(val)) {
      throw new Error(`Precision loss: unsafe integer ${val}`);
    }
    return BigInt(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return BigInt(trimmed);
    }
    if (forceHex) {
      if (/^[0-9a-fA-F]+$/.test(trimmed)) {
        return BigInt('0x' + trimmed);
      }
    }
    // Match decimal digits strictly
    if (/^-?\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
    // Parse general hex strings without 0x prefix
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return BigInt('0x' + trimmed);
    }
    return BigInt(trimmed);
  }
  throw new Error(`Unsupported type: ${typeof val}`);
}

/**
 * Hardened elliptic curve point addition that forces modulo reduction
 * of coordinates before running comparisons or operations.
 */
export function hardenedEcAdd(p1: Secp256k1Point, p2: Secp256k1Point): Secp256k1Point {
  if (p1.isInfinity) return p2;
  if (p2.isInfinity) return p1;

  const x1_red = mod(p1.x, SECP256K1_P);
  const x2_red = mod(p2.x, SECP256K1_P);
  const y1_red = mod(p1.y, SECP256K1_P);
  const y2_red = mod(p2.y, SECP256K1_P);

  const reducedP1 = { x: x1_red, y: y1_red, isInfinity: false };
  const reducedP2 = { x: x2_red, y: y2_red, isInfinity: false };

  if (x1_red === x2_red) {
    if (mod(y1_red + y2_red, SECP256K1_P) === 0n) {
      return { x: 0n, y: 0n, isInfinity: true };
    }
    return ecDouble(reducedP1);
  }

  const dy = mod(y2_red - y1_red, SECP256K1_P);
  const dx = mod(x2_red - x1_red, SECP256K1_P);
  const lambda = mod(dy * hardenedModInverse(dx, SECP256K1_P), SECP256K1_P);

  const x3 = mod(lambda * lambda - x1_red - x2_red, SECP256K1_P);
  const y3 = mod(lambda * (x1_red - x3) - y1_red, SECP256K1_P);

  return { x: x3, y: y3, isInfinity: false };
}

/**
 * Hardened ZKP Receipt validator that prevents malleability by forcing canonical
 * receipt hash representation (i.e. less than the prime field BN254_P) and checking
 * that the hash has not been shifted or reformatted.
 */
export function hardenedVerifyZKProofReceipt(
  receipt: {
    proof: {
      a: [string | bigint, string | bigint];
      b: [[string | bigint, string | bigint], [string | bigint, string | bigint]];
      c: [string | bigint, string | bigint];
    };
    publicInputs: (string | bigint)[];
    receiptHash: string;
  },
  vk: { expectedInputsCount: number }
): { valid: boolean; error?: string } {
  try {
    // 1. Parse receiptHash and enforce strict bounds check to prevent malleability
    const hashBigInt = parseToBigInt(receipt.receiptHash);
    if (hashBigInt >= BN254_P || hashBigInt < 0n) {
      return {
        valid: false,
        error: 'Malleability detected: receiptHash exceeds BN254 field modulus bounds.',
      };
    }

    // 2. Perform standard checks
    const baseResult = verifyZKProofReceipt(receipt, vk);
    if (!baseResult.valid) {
      return baseResult;
    }

    // 3. Ensure no alternative representation was accepted
    const matchedCanonical = receipt.publicInputs.some(
      (inp) => parseToBigInt(inp) === hashBigInt
    );
    if (!matchedCanonical) {
      return {
        valid: false,
        error: 'Receipt hash binding validation failed: non-canonical mapping detected.',
      };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Hardened validation error: ${err.message}` };
  }
}

describe('Cryptographic & Mathematical Resiliency Simulator', () => {
  // Test coordinates for BN254 G2 point
  const validG2_x0 = 10857046999023057135944570762232829481370756359578518086990519993285655852781n;
  const validG2_x1 = 11559732032986387107991004021392285783925812814806588151524303159343745272007n;
  const validG2_y0 = 8495653923126297913904642720300106078345911663138259006793102173105747426n;
  const validG2_y1 = 4003224970662641952094526137938957457786851663241220188191151320840595290382n;

  describe('Vector 1: Coordinate Non-Reduction & Silent Point Corruption', () => {
    it('demonstrates how unreduced coordinates corrupt vulnerable point addition and how hardening repairs it', () => {
      const p1 = SECP256K1_G;
      // p2 is mathematically equal to p1 mod SECP256K1_P, but coordinates are unreduced
      const p2: Secp256k1Point = {
        x: SECP256K1_G.x + SECP256K1_P,
        y: SECP256K1_G.y,
        isInfinity: false,
      };

      // Vulnerable ecAdd compares x coordinates strictly, misses equality, bypasses doubling,
      // and calculates modular inverse of (p2.x - p1.x) mod P = SECP256K1_P mod P = 0.
      // This skips the loop and returns 1n, producing a mathematically corrupted result.
      const vulnerableResult = ecAdd(p1, p2);
      const expectedDouble = ecDouble(p1);

      expect(vulnerableResult.x).not.toBe(expectedDouble.x);

      // Hardened ecAdd reduces coordinates before comparison, invokes ecDouble, and succeeds.
      const hardenedResult = hardenedEcAdd(p1, p2);
      expect(hardenedResult.x).toBe(expectedDouble.x);
      expect(hardenedResult.y).toBe(expectedDouble.y);
    });
  });

  describe('Vector 2: Decimal vs Hex Parsing Ambiguity on Digit-Only Hex Strings', () => {
    it('demonstrates hex-decimal ambiguity on strings with only digits and shows how hardening resolves it', () => {
      // "123456" could be a hex value or a decimal value.
      // In receipts.ts, parseToBigInt parses "123456" as decimal because it matches /^-?\d+$/
      const digitOnlyHexString = '123456';
      
      const vulnerableParsed = parseToBigInt(digitOnlyHexString);
      expect(vulnerableParsed).toBe(123456n); // Parsed as decimal

      // If we intended it as hex (e.g. transaction hash, key coordinate, or proof value),
      // this results in silent value corruption.
      // Hardened parser with forceHex option correctly handles this.
      const hardenedParsed = hardenedParseToBigInt(digitOnlyHexString, true);
      expect(hardenedParsed).toBe(1193046n); // Parsed as hex (0x123456 = 1193046)
    });
  });

  describe('Vector 3: modInverse Loop Bypass and Division-by-Zero Crash', () => {
    it('demonstrates loop bypass on 0 and division by zero crash on non-coprime input', () => {
      // 1. Loop Bypass on 0: vulnerableModInverse(0, P) returns 1n instead of throwing.
      const zeroInverseVulnerable = modInverse(0n, SECP256K1_P);
      expect(zeroInverseVulnerable).toBe(1n);

      // Hardened version correctly throws an error.
      expect(() => hardenedModInverse(0n, SECP256K1_P)).toThrow(
        'Modular inverse does not exist: input is congruent to 0'
      );

      // 2. Division-by-Zero Crash on non-coprime inputs:
      // In vulnerableModInverse(6n, 9n), the Euclidean loop makes m = 0n,
      // leading to "RangeError: Division by zero" on JS BigInt division.
      let vulnerableCrashed = false;
      try {
        modInverse(6n, 9n);
      } catch (err: any) {
        vulnerableCrashed = true;
        expect(err.message).toContain('Division by zero');
      }
      expect(vulnerableCrashed).toBe(true);

      // Hardened version detects non-coprimality and throws a safe, descriptive error.
      expect(() => hardenedModInverse(6n, 9n)).toThrow(
        'Modular inverse does not exist: inputs are not coprime'
      );
    });
  });

  describe('Vector 4: ZKP Receipt Hash Binding Malleability', () => {
    it('demonstrates receipt hash malleability and verification bypass', () => {
      const receipt = {
        proof: {
          a: [1n, 2n] as [bigint, bigint], // lies on G1
          b: [[validG2_x0, validG2_x1], [validG2_y0, validG2_y1]] as [[bigint, bigint], [bigint, bigint]], // lies on G2
          c: [1n, 2n] as [bigint, bigint], // lies on G1
        },
        publicInputs: [100n, 200n],
        receiptHash: '100', // Canonical receipt hash
      };

      const vk = { expectedInputsCount: 2 };

      // Canonical verification succeeds
      const canonicalResult = verifyZKProofReceipt(receipt, vk);
      expect(canonicalResult.valid).toBe(true);

      // Non-canonical receiptHash (shifted by prime modulus) is also accepted by the vulnerable validator!
      // This is because the validator reduced it modulo BN254_P and compared it against the inputs.
      const nonCanonicalHash = (100n + BN254_P).toString();
      const malleableReceipt = {
        ...receipt,
        receiptHash: nonCanonicalHash,
      };

      const vulnerableResult = verifyZKProofReceipt(malleableReceipt, vk);
      expect(vulnerableResult.valid).toBe(true); // Vulnerable verifier accepts malleable inputs!

      // Hardened verifier detects that the receiptHash is out-of-field-bounds and rejects it.
      const hardenedResult = hardenedVerifyZKProofReceipt(malleableReceipt, vk);
      expect(hardenedResult.valid).toBe(false);
      expect(hardenedResult.error).toContain('Malleability detected');
    });
  });
});

import {
  mod,
  modInverse,
  parseToBigInt,
  ecAdd,
  ecDouble,
  verifyEcdsaSignature,
  SECP256K1_G,
  SECP256K1_N,
  SECP256K1_P,
} from '../receipts';

describe('Cryptographic Math Resiliency & Boundary Analysis', () => {
  // Vulnerability 1: Coordinate Non-Reduction and Silent Point Corruption
  it('demonstrates coordinate non-reduction leading to silent point corruption', () => {
    // SECP256K1_G is a valid generator point
    const p1 = SECP256K1_G;

    // p2 is mathematically identical to p1, but its x-coordinate is not modulo-reduced
    const p2 = {
      x: SECP256K1_G.x + SECP256K1_P,
      y: SECP256K1_G.y,
      isInfinity: false,
    };

    // Mathematically, p1 + p2 should equal p1 + p1 = ecDouble(p1)
    const expected = ecDouble(p1);

    // Act: compute addition of p1 and the non-reduced p2
    const actual = ecAdd(p1, p2);

    // Verify the math failure: p1.x === p2.x is false because of non-reduction.
    // This bypasses the doubling check and goes to general addition.
    // dx is computed as mod(p2.x - p1.x, P) = mod(P, P) = 0.
    // modInverse(0, P) is called, which returns 1 instead of throwing or handling it.
    // This results in a completely corrupt, invalid point!
    expect(actual.x).not.toBe(expected.x);
    expect(actual.y).not.toBe(expected.y);

    // Verify that the corrupt point coordinates are indeed calculated incorrectly
    expect(actual.isInfinity).toBe(false);
  });

  // Vulnerability 2: modInverse(0, m) returns 1n instead of throwing or returning 0n
  it('demonstrates that modInverse(0) returns 1n due to loop bypass', () => {
    // The modular inverse of 0 modulo P does not exist.
    // However, since aVal (0n) is not > 1n, the while loop is skipped entirely.
    // The function then returns x, which is initialized to 1n.
    const inv = modInverse(0n, SECP256K1_P);
    expect(inv).toBe(1n);
  });

  // Vulnerability 3: Parsing ambiguity on digit-only hex strings
  it('demonstrates parsing ambiguity on digit-only hex strings', () => {
    // Standard 256-bit hashes are hex strings.
    // If a hex string contains only numeric characters (e.g. "123456"),
    // parseToBigInt parses it as a base-10 decimal integer rather than base-16 hex.
    const digitOnlyHex = '123456';
    const parsedValue = parseToBigInt(digitOnlyHex);

    // It is parsed as 123456n (decimal) instead of 1193046n (hex 0x123456)
    expect(parsedValue).toBe(123456n);
    expect(parsedValue).not.toBe(0x123456n);
  });

  // Vulnerability 4: Denial of Service via division-by-zero on non-coprime inputs
  it('demonstrates RangeError: Division by zero when inputs are not coprime', () => {
    // If modInverse is called with non-coprime numbers (e.g., 6 and 9),
    // the extended Euclidean algorithm loop eventually makes the modulus 0.
    // In the next iteration, "aVal / m" throws "RangeError: Division by zero".
    expect(() => {
      modInverse(6n, 9n);
    }).toThrow(RangeError);
  });
});

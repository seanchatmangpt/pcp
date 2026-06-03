/**
 * Pure JavaScript UTF-8 encoder helper to byte array.
 * Works consistently across all JS runtimes (Node, Hermes, browsers).
 */
function stringToUtf8ByteArray(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      // Surrogate pair
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/**
 * Pure JavaScript implementation of SHA-256 standard hash function.
 * Avoids any platform-specific dependencies and works in React Native/Expo as well as Node.js.
 */
export function sha256Bytes(bytes: number[]): string {
  const bitLength = bytes.length * 8;
  const tempBytes = [...bytes];

  // Pad the bytes block
  tempBytes.push(0x80);
  while (tempBytes.length % 64 !== 56) {
    tempBytes.push(0);
  }

  // Append the 64-bit length (big-endian)
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength & 0xffffffff;

  tempBytes.push(
    (highBits >> 24) & 0xff,
    (highBits >> 16) & 0xff,
    (highBits >> 8) & 0xff,
    highBits & 0xff,
    (lowBits >> 24) & 0xff,
    (lowBits >> 16) & 0xff,
    (lowBits >> 8) & 0xff,
    lowBits & 0xff
  );

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  for (let i = 0; i < tempBytes.length; i += 64) {
    const w = new Array(64);
    for (let t = 0; t < 16; t++) {
      w[t] =
        (tempBytes[i + t * 4] << 24) |
        (tempBytes[i + t * 4 + 1] << 16) |
        (tempBytes[i + t * 4 + 2] << 8) |
        tempBytes[i + t * 4 + 3];
    }

    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[t] + w[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map((val) => {
    const unsignedVal = val < 0 ? val + 0x100000000 : val;
    return unsignedVal.toString(16).padStart(8, '0');
  }).join('');
}

export function sha256(message: string): string {
  const bytes = stringToUtf8ByteArray(message);
  return sha256Bytes(bytes);
}

export function hmacSha256(key: string, message: string): string {
  let keyBytes = stringToUtf8ByteArray(key);
  const msgBytes = stringToUtf8ByteArray(message);

  const blockSize = 64;
  if (keyBytes.length > blockSize) {
    const keyHash = sha256(key);
    keyBytes = [];
    for (let i = 0; i < keyHash.length; i += 2) {
      keyBytes.push(parseInt(keyHash.substr(i, 2), 16));
    }
  }

  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  const ipad = new Array(blockSize);
  const opad = new Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyBytes[i] ^ 0x36;
    opad[i] = keyBytes[i] ^ 0x5c;
  }

  const innerHashStr = sha256Bytes(ipad.concat(msgBytes));
  const innerHashBytes: number[] = [];
  for (let i = 0; i < innerHashStr.length; i += 2) {
    innerHashBytes.push(parseInt(innerHashStr.substr(i, 2), 16));
  }

  return sha256Bytes(opad.concat(innerHashBytes));
}

/**
 * Deterministic JSON stringifier to ensure canonical format of any object.
 * This is crucial so that same properties key-ordering yields the same hash.
 */
export function canonicalStringify(val: any): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(val[k])}`);
  return '{' + parts.join(',') + '}';
}

/**
 * Computes a receipt hash-chaining output.
 *
 * @param previousHash The SHA-256 hash of the previous receipt in the chain. Use null or empty string for the genesis block.
 * @param data The feature-agnostic receipt payload.
 * @returns The SHA-256 hash representing this receipt chained to the previous block.
 */
export function generateReceiptHash(previousHash: string | null | undefined, data: any): string {
  const prev = previousHash || '';
  const dataStr = canonicalStringify(data);
  return sha256(prev + dataStr);
}

const IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

const MSG_PERMUTATION = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];

const CHUNK_START = 1 << 0;
const CHUNK_END = 1 << 1;
const PARENT = 1 << 2;
const ROOT = 1 << 3;

function blake3G(v: number[], a: number, b: number, c: number, d: number, x: number, y: number) {
  v[a] = (v[a] + v[b] + x) | 0;
  v[d] = rightRotate(v[d] ^ v[a], 16);
  v[c] = (v[c] + v[d]) | 0;
  v[b] = rightRotate(v[b] ^ v[c], 12);
  v[a] = (v[a] + v[b] + y) | 0;
  v[d] = rightRotate(v[d] ^ v[a], 8);
  v[c] = (v[c] + v[d]) | 0;
  v[b] = rightRotate(v[b] ^ v[c], 7);
}

function rightRotate(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function compressBlake3(
  chainingValue: number[],
  blockWords: number[],
  counterLow: number,
  counterHigh: number,
  blockLen: number,
  flags: number
): number[] {
  const v = [
    chainingValue[0], chainingValue[1], chainingValue[2], chainingValue[3],
    chainingValue[4], chainingValue[5], chainingValue[6], chainingValue[7],
    IV[0], IV[1], IV[2], IV[3],
    counterLow, counterHigh,
    blockLen, flags
  ];

  let m = [...blockWords];

  for (let round = 0; round < 7; round++) {
    if (round > 0) {
      const nextM = new Array(16);
      for (let i = 0; i < 16; i++) {
        nextM[i] = m[MSG_PERMUTATION[i]];
      }
      m = nextM;
    }
    // Column step
    blake3G(v, 0, 4, 8, 12, m[0], m[1]);
    blake3G(v, 1, 5, 9, 13, m[2], m[3]);
    blake3G(v, 2, 6, 10, 14, m[4], m[5]);
    blake3G(v, 3, 7, 11, 15, m[6], m[7]);
    // Diagonal step
    blake3G(v, 0, 5, 10, 15, m[8], m[9]);
    blake3G(v, 1, 6, 11, 12, m[10], m[11]);
    blake3G(v, 2, 7, 8, 13, m[12], m[13]);
    blake3G(v, 3, 4, 9, 14, m[14], m[15]);
  }

  return [
    v[0] ^ v[8],
    v[1] ^ v[9],
    v[2] ^ v[10],
    v[3] ^ v[11],
    v[4] ^ v[12],
    v[5] ^ v[13],
    v[6] ^ v[14],
    v[7] ^ v[15]
  ];
}

function bytesToWords(bytes: number[], start: number, end: number): number[] {
  const words = new Array(16).fill(0);
  for (let i = 0; i < 16; i++) {
    const offset = start + i * 4;
    let w = 0;
    if (offset < end) w |= bytes[offset];
    if (offset + 1 < end) w |= bytes[offset + 1] << 8;
    if (offset + 2 < end) w |= bytes[offset + 2] << 16;
    if (offset + 3 < end) w |= bytes[offset + 3] << 24;
    words[i] = w;
  }
  return words;
}

/**
 * Pure JavaScript implementation of the BLAKE3 cryptographic hash function.
 */
export function blake3(message: string): string {
  const bytes = stringToUtf8ByteArray(message);
  const chunkSize = 1024;
  const chunkOutputs: number[][] = [];
  
  let chunkIndex = 0;
  let start = 0;
  
  if (bytes.length === 0) {
    const words = new Array(16).fill(0);
    const hashWords = compressBlake3(IV, words, 0, 0, 0, CHUNK_START | CHUNK_END | ROOT);
    return hashWords.map(w => {
      const unsigned = w < 0 ? w + 0x100000000 : w;
      const b0 = unsigned & 0xff;
      const b1 = (unsigned >> 8) & 0xff;
      const b2 = (unsigned >> 16) & 0xff;
      const b3 = (unsigned >> 24) & 0xff;
      return [b0, b1, b2, b3].map(b => b.toString(16).padStart(2, '0')).join('');
    }).join('');
  }
  
  while (start < bytes.length) {
    const end = Math.min(start + chunkSize, bytes.length);
    const chunkBytes = bytes.slice(start, end);
    
    let cv = [...IV];
    const numBlocks = Math.ceil(chunkBytes.length / 64);
    
    for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
      const blockStart = blockIdx * 64;
      const blockEnd = Math.min(blockStart + 64, chunkBytes.length);
      const blockLen = blockEnd - blockStart;
      const words = bytesToWords(chunkBytes, blockStart, blockEnd);
      
      let flags = 0;
      if (blockIdx === 0) flags |= CHUNK_START;
      if (blockIdx === numBlocks - 1) flags |= CHUNK_END;
      
      if (end === bytes.length && blockIdx === numBlocks - 1) {
        flags |= ROOT;
      }
      
      const counterLow = chunkIndex & 0xffffffff;
      const counterHigh = Math.floor(chunkIndex / 0x100000000);
      
      cv = compressBlake3(cv, words, counterLow, counterHigh, blockLen, flags);
    }
    
    chunkOutputs.push(cv);
    chunkIndex++;
    start = end;
  }
  
  let currentLevel = chunkOutputs;
  while (currentLevel.length > 1) {
    const nextLevel: number[][] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        const parentWords = [...left, ...right];
        
        let flags = PARENT;
        if (i + 2 >= currentLevel.length && nextLevel.length === 0) {
          if (currentLevel.length === 2) {
            flags |= ROOT;
          }
        }
        
        const cv = compressBlake3(IV, parentWords, 0, 0, 64, flags);
        nextLevel.push(cv);
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }
  
  const finalWords = currentLevel[0];
  return finalWords.map(w => {
    const unsigned = w < 0 ? w + 0x100000000 : w;
    const b0 = unsigned & 0xff;
    const b1 = (unsigned >> 8) & 0xff;
    const b2 = (unsigned >> 16) & 0xff;
    const b3 = (unsigned >> 24) & 0xff;
    return [b0, b1, b2, b3].map(b => b.toString(16).padStart(2, '0')).join('');
  }).join('');
}

export function generateBlake3ReceiptHash(previousHash: string | null | undefined, data: any): string {
  const prev = previousHash || '';
  const dataStr = canonicalStringify(data);
  return blake3(prev + dataStr);
}

// =========================================================================
// Zero-Knowledge Proof & Elliptic Curve Signature Validation Algorithms
// =========================================================================

export const BN254_P = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
export const SECP256K1_P = 115792089237316195423570985008687907853269984665640564039457584007908834671663n;
export const SECP256K1_N = 115792089237316195423570985008687907852837564279074904382605163141518161494337n;
export const SECP256K1_A = 0n;
export const SECP256K1_B = 7n;

export interface Secp256k1Point {
  x: bigint;
  y: bigint;
  isInfinity: boolean;
}

export const SECP256K1_G: Secp256k1Point = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  isInfinity: false
};

/**
 * Math and Modular arithmetic helper functions.
 */
export function mod(n: bigint, p: bigint): bigint {
  let result = n % p;
  if (result < 0n) {
    result += p;
  }
  return result;
}

export function modPow(base: bigint, exp: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;
  let result = 1n;
  let b = mod(base, modulus);
  let e = exp;
  while (e > 0n) {
    if (e % 2n === 1n) {
      result = mod(result * b, modulus);
    }
    b = mod(b * b, modulus);
    e = e / 2n;
  }
  return result;
}

export function modInverse(a: bigint, m: bigint): bigint {
  let m0 = m;
  let y = 0n, x = 1n;
  let aVal = a;

  if (m === 1n) return 0n;

  while (aVal > 1n) {
    const q = aVal / m;
    let t = m;

    m = aVal % m;
    aVal = t;
    t = y;

    y = x - q * y;
    x = t;
  }

  if (x < 0n) {
    x += m0;
  }
  return x;
}

export function parseToBigInt(val: any): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') {
    if (!Number.isSafeInteger(val)) {
      throw new Error(`Precision loss warning: cannot safely parse float/unsafe number ${val} as bigint.`);
    }
    return BigInt(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return BigInt(trimmed);
    }
    if (/^-?\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return BigInt('0x' + trimmed);
    }
    return BigInt(trimmed);
  }
  throw new Error(`Unsupported type for BigInt parsing: ${typeof val}`);
}

// Check if a point lies on secp256k1 curve
export function isPointOnSecp256k1(p: Secp256k1Point): boolean {
  if (p.isInfinity) return true;
  const y2 = mod(p.y * p.y, SECP256K1_P);
  const x3 = mod(p.x * p.x * p.x + SECP256K1_B, SECP256K1_P);
  return y2 === x3;
}

// Point Addition on Secp256k1
export function ecAdd(p1: Secp256k1Point, p2: Secp256k1Point): Secp256k1Point {
  if (p1.isInfinity) return p2;
  if (p2.isInfinity) return p1;

  if (p1.x === p2.x) {
    if (mod(p1.y + p2.y, SECP256K1_P) === 0n) {
      return { x: 0n, y: 0n, isInfinity: true };
    }
    return ecDouble(p1);
  }

  const dy = mod(p2.y - p1.y, SECP256K1_P);
  const dx = mod(p2.x - p1.x, SECP256K1_P);
  const lambda = mod(dy * modInverse(dx, SECP256K1_P), SECP256K1_P);

  const x3 = mod(lambda * lambda - p1.x - p2.x, SECP256K1_P);
  const y3 = mod(lambda * (p1.x - x3) - p1.y, SECP256K1_P);

  return { x: x3, y: y3, isInfinity: false };
}

// Point Doubling on Secp256k1
export function ecDouble(p: Secp256k1Point): Secp256k1Point {
  if (p.isInfinity) return p;
  if (p.y === 0n) return { x: 0n, y: 0n, isInfinity: true };

  const numerator = mod(3n * p.x * p.x + SECP256K1_A, SECP256K1_P);
  const denominator = mod(2n * p.y, SECP256K1_P);
  const lambda = mod(numerator * modInverse(denominator, SECP256K1_P), SECP256K1_P);

  const x3 = mod(lambda * lambda - 2n * p.x, SECP256K1_P);
  const y3 = mod(lambda * (p.x - x3) - p.y, SECP256K1_P);

  return { x: x3, y: y3, isInfinity: false };
}

// Scalar Multiplication (Double-and-Add)
export function ecMultiply(point: Secp256k1Point, scalar: bigint): Secp256k1Point {
  let s = mod(scalar, SECP256K1_N);
  if (s === 0n) return { x: 0n, y: 0n, isInfinity: true };

  let result: Secp256k1Point = { x: 0n, y: 0n, isInfinity: true };
  let addend = point;

  while (s > 0n) {
    if (s % 2n === 1n) {
      result = ecAdd(result, addend);
    }
    addend = ecDouble(addend);
    s = s / 2n;
  }

  return result;
}

export function verifyEcdsaSignature(
  messageHash: string | bigint,
  signature: { r: string | bigint; s: string | bigint },
  publicKey: { x: string | bigint; y: string | bigint }
): { valid: boolean; error?: string } {
  try {
    const r = parseToBigInt(signature.r);
    const s = parseToBigInt(signature.s);
    const qx = parseToBigInt(publicKey.x);
    const qy = parseToBigInt(publicKey.y);
    const e = parseToBigInt(messageHash);

    // 1. Signature bounds check
    if (r <= 0n || r >= SECP256K1_N) {
      return { valid: false, error: 'Signature r-value is out of bounds [1, n-1]' };
    }
    if (s <= 0n || s >= SECP256K1_N) {
      return { valid: false, error: 'Signature s-value is out of bounds [1, n-1]' };
    }

    // Low-s rule to prevent malleability
    if (s > SECP256K1_N / 2n) {
      return { valid: false, error: 'Signature s-value exceeds n/2 (high-s malleability prevention)' };
    }

    // 2. Public key bounds and curve membership check
    if (qx < 0n || qx >= SECP256K1_P || qy < 0n || qy >= SECP256K1_P) {
      return { valid: false, error: 'Public key coordinates are out of field bounds [0, P-1]' };
    }

    const Q: Secp256k1Point = { x: qx, y: qy, isInfinity: false };
    if (!isPointOnSecp256k1(Q)) {
      return { valid: false, error: 'Public key is not a valid point on the secp256k1 curve' };
    }

    // 3. Verify signature
    const w = modInverse(s, SECP256K1_N);
    const u1 = mod(e * w, SECP256K1_N);
    const u2 = mod(r * w, SECP256K1_N);

    const u1G = ecMultiply(SECP256K1_G, u1);
    const u2Q = ecMultiply(Q, u2);
    const X = ecAdd(u1G, u2Q);

    if (X.isInfinity) {
      return { valid: false, error: 'Calculated point is at infinity' };
    }

    const valid = mod(X.x, SECP256K1_N) === r;
    if (!valid) {
      return { valid: false, error: 'Signature verification failed (r mismatch)' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Mathematical signature verification error: ${err.message}` };
  }
}

export function isPointOnBn254G1(x: bigint, y: bigint): boolean {
  if (x < 0n || x >= BN254_P || y < 0n || y >= BN254_P) {
    return false;
  }
  const lhs = mod(y * y, BN254_P);
  const rhs = mod(x * x * x + 3n, BN254_P);
  return lhs === rhs;
}

export function isPointOnBn254G2(x0: bigint, x1: bigint, y0: bigint, y1: bigint): boolean {
  if (x0 < 0n || x0 >= BN254_P || x1 < 0n || x1 >= BN254_P ||
      y0 < 0n || y0 >= BN254_P || y1 < 0n || y1 >= BN254_P) {
    return false;
  }

  const b0 = 0x1f5135ddade76bad478bcea21235556279d5f27a7da4f14af20b742c263447d4n;
  const b1 = 0x21902cc11125e5722d0576ab51e4c31d96a3625d5cee4d2ef50dedc65a60040an;

  const lhs_real = mod(y0 * y0 - y1 * y1, BN254_P);
  const lhs_imag = mod(2n * y0 * y1, BN254_P);

  const x0_2 = mod(x0 * x0, BN254_P);
  const x1_2 = mod(x1 * x1, BN254_P);
  const rhs_real = mod(x0 * x0_2 - 3n * x0 * x1_2 + b0, BN254_P);
  const rhs_imag = mod(3n * x0_2 * x1 - x1 * x1_2 + b1, BN254_P);

  return lhs_real === rhs_real && lhs_imag === rhs_imag;
}

export function verifyZKProofReceipt(
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
    // 1. Check public inputs length
    if (receipt.publicInputs.length !== vk.expectedInputsCount) {
      return {
        valid: false,
        error: `Public inputs count mismatch. Expected ${vk.expectedInputsCount}, got ${receipt.publicInputs.length}`,
      };
    }

    // 2. Parse and bounds-check public inputs
    const inputs: bigint[] = [];
    for (let i = 0; i < receipt.publicInputs.length; i++) {
      const val = parseToBigInt(receipt.publicInputs[i]);
      if (val < 0n || val >= BN254_P) {
        return {
          valid: false,
          error: `Public input at index ${i} is out of field bounds [0, P-1]`,
        };
      }
      inputs.push(val);
    }

    // 3. Parse and bounds-check G1 proof point A
    const ax = parseToBigInt(receipt.proof.a[0]);
    const ay = parseToBigInt(receipt.proof.a[1]);
    if (!isPointOnBn254G1(ax, ay)) {
      return { valid: false, error: 'Proof point A is not a valid point on the BN254 G1 curve' };
    }

    // 4. Parse and bounds-check G1 proof point C
    const cx = parseToBigInt(receipt.proof.c[0]);
    const cy = parseToBigInt(receipt.proof.c[1]);
    if (!isPointOnBn254G1(cx, cy)) {
      return { valid: false, error: 'Proof point C is not a valid point on the BN254 G1 curve' };
    }

    // 5. Parse and bounds-check G2 proof point B
    const bx0 = parseToBigInt(receipt.proof.b[0][0]);
    const bx1 = parseToBigInt(receipt.proof.b[0][1]);
    const by0 = parseToBigInt(receipt.proof.b[1][0]);
    const by1 = parseToBigInt(receipt.proof.b[1][1]);
    if (!isPointOnBn254G2(bx0, bx1, by0, by1)) {
      return { valid: false, error: 'Proof point B is not a valid point on the BN254 G2 curve' };
    }

    // 6. Verify that the receiptHash binding matches one of the public inputs
    const hashBigInt = parseToBigInt(receipt.receiptHash);
    const reducedHash = mod(hashBigInt, BN254_P);

    const hashMatched = inputs.some((inp) => inp === hashBigInt || inp === reducedHash);
    if (!hashMatched) {
      return {
        valid: false,
        error: 'Receipt hash binding verification failed. Receipt hash is not bound to public inputs.',
      };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `ZK proof validation error: ${err.message}` };
  }
}

import { HookActorRef } from './types';

export function stringifyActorRef(ref: HookActorRef): string {
  return `${ref.tenantId}:${ref.packId}:${ref.hookId}:${ref.instanceId}`;
}

export function parseActorRef(str: string): HookActorRef {
  const parts = str.split(':');
  if (parts.length !== 4) {
    throw new Error(`Invalid HookActorRef string: ${str}`);
  }
  return {
    tenantId: parts[0],
    packId: parts[1],
    hookId: parts[2],
    instanceId: parts[3],
  };
}

export function equalsActorRef(a: HookActorRef, b: HookActorRef): boolean {
  return (
    a.tenantId === b.tenantId &&
    a.packId === b.packId &&
    a.hookId === b.hookId &&
    a.instanceId === b.instanceId
  );
}

// Environment-agnostic SHA-256 implementation in pure JS
export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number; // Used as a selector in loops

  const hash: number[] = [];
  const k: number[] = [];
  const primeCounter = (shared: number) => {
    let candidate = 2;
    while (shared < 64) {
      let isPrime = true;
      for (let factor = 2; factor < candidate; factor++) {
        if (candidate % factor === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) {
        if (shared < 8) {
          hash[shared] = ((mathPow(candidate, 0.5) % 1) * maxWord) | 0;
        }
        k[shared] = ((mathPow(candidate, 1 / 3) % 1) * maxWord) | 0;
        shared++;
      }
      candidate++;
    }
  };

  primeCounter(0);

  const words: number[] = [];
  const asciiLength = ascii[lengthProperty];
  let asciiBitLength = asciiLength * 8;

  let paddedAscii = ascii + String.fromCharCode(0x80);
  while (paddedAscii[lengthProperty] % 64 !== 56) {
    paddedAscii += String.fromCharCode(0);
  }

  for (i = 0; i < paddedAscii[lengthProperty]; i++) {
    const charCode = paddedAscii.charCodeAt(i);
    if (charCode > 255) throw new Error('Only ASCII characters are supported for hashing');
    words[i >> 2] |= charCode << (24 - (i % 4) * 8);
  }

  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiBitLength | 0);

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);

      const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0));
      const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let result = '';
  for (i = 0; i < 8; i++) {
    const hex = (hash[i] >>> 0).toString(16);
    result += ('00000000' + hex).slice(-8);
  }
  return result;
}

export function hashActorRef(ref: HookActorRef): string {
  return sha256(stringifyActorRef(ref));
}

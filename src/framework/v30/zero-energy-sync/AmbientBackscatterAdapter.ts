export interface BackscatterConfig {
  baseFrequencyHz: number;
  reflectionCoefficient: number;
  snrThreshold: number;
}

export interface EncodedDelta {
  payload: string;
  modulation: 'OOK' | 'FSK';
  energyCostMicroJoules: number;
}

export class AmbientBackscatterAdapter {
  private config: BackscatterConfig;
  private buffer: string[] = [];
  private isTransmitting: boolean = false;

  constructor(config: Partial<BackscatterConfig> = {}) {
    this.config = {
      baseFrequencyHz: config.baseFrequencyHz ?? 2.4e9,
      reflectionCoefficient: config.reflectionCoefficient ?? 0.8,
      snrThreshold: config.snrThreshold ?? 15.0,
    };
  }

  public bufferDelta(crdtDelta: string): void {
    if (!crdtDelta) throw new Error('Invalid delta');
    this.buffer.push(crdtDelta);
  }

  public encodeBuffer(): EncodedDelta[] {
    const encoded: EncodedDelta[] = [];
    for (const delta of this.buffer) {
      const payloadLength = delta.length;
      const energyCost = payloadLength * 0.05 * (1 / this.config.reflectionCoefficient);
      encoded.push({
        payload: Buffer.from(delta).toString('base64'),
        modulation: payloadLength > 100 ? 'FSK' : 'OOK',
        energyCostMicroJoules: energyCost,
      });
    }
    this.buffer = [];
    return encoded;
  }

  public async transmit(ambientSignalStrength: number): Promise<boolean> {
    if (this.isTransmitting) {
      throw new Error('Already transmitting');
    }
    this.isTransmitting = true;

    try {
      const snr = ambientSignalStrength * this.config.reflectionCoefficient;
      if (snr < this.config.snrThreshold) {
        return false;
      }

      const encoded = this.encodeBuffer();
      if (encoded.length === 0) return true;

      await new Promise((resolve) => setTimeout(resolve, encoded.length * 5));

      return true;
    } finally {
      this.isTransmitting = false;
    }
  }

  public receive(encodedDelta: EncodedDelta, ambientNoise: number): string | null {
    const effectiveSnr = (100 - ambientNoise) * this.config.reflectionCoefficient;
    if (effectiveSnr < this.config.snrThreshold) {
      return null;
    }
    if (typeof encodedDelta.payload !== 'string') {
      return null;
    }
    return Buffer.from(encodedDelta.payload, 'base64').toString('utf8');
  }
}

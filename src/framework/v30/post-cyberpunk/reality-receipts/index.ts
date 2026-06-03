import { sha256, hmacSha256 } from '../../../../lib/crypto/receipts';

export interface ZKPIdentity {
  proof: string;
  publicSignals: string[];
}

export interface HardwareTelemetry {
  deviceId: string;
  cpuCores: number;
  memoryCapacity: number;
  secureEnclavePresent: boolean;
}

export interface BehavioralIntent {
  action: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface RealityReceiptData {
  zkpIdentity: ZKPIdentity;
  hardwareTelemetry: HardwareTelemetry;
  behavioralIntent: BehavioralIntent;
}

export interface RealityReceipt {
  version: '1.0.0';
  data: RealityReceiptData;
  signature: string;
  hash: string;
}

export class RealityReceiptGenerator {
  private readonly systemSecret: string;

  constructor(systemSecret: string) {
    if (!systemSecret) {
      throw new Error('System secret is required for unforgeable artifact generation');
    }
    this.systemSecret = systemSecret;
  }

  public generate(data: RealityReceiptData): RealityReceipt {
    this.validateData(data);
    const serializedData = this.serializeData(data);
    const hash = sha256(serializedData);
    const signature = hmacSha256(this.systemSecret, hash);

    return {
      version: '1.0.0',
      data,
      hash,
      signature,
    };
  }

  public verifyReality(receipt: RealityReceipt): boolean {
    if (!receipt || receipt.version !== '1.0.0') {
      return false;
    }

    try {
      this.validateData(receipt.data);
    } catch (e) {
      return false;
    }

    const serializedData = this.serializeData(receipt.data);
    const expectedHash = sha256(serializedData);

    if (expectedHash !== receipt.hash) {
      return false;
    }

    const expectedSignature = hmacSha256(this.systemSecret, expectedHash);

    if (expectedSignature.length !== receipt.signature.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      diff |= expectedSignature.charCodeAt(i) ^ receipt.signature.charCodeAt(i);
    }
    return diff === 0;
  }

  public serialize(receipt: RealityReceipt): string {
    return JSON.stringify(receipt);
  }

  public deserialize(payload: string): RealityReceipt {
    const parsed = JSON.parse(payload) as RealityReceipt;
    if (!parsed || !parsed.version || !parsed.data || !parsed.signature || !parsed.hash) {
      throw new Error('Invalid RealityReceipt payload');
    }
    return parsed;
  }

  private validateData(data: RealityReceiptData): void {
    if (!data) {
      throw new Error('Data is undefined');
    }
    if (
      !data.zkpIdentity ||
      typeof data.zkpIdentity.proof !== 'string' ||
      !Array.isArray(data.zkpIdentity.publicSignals)
    ) {
      throw new Error('Invalid ZKPIdentity');
    }
    if (!data.hardwareTelemetry || typeof data.hardwareTelemetry.deviceId !== 'string') {
      throw new Error('Invalid HardwareTelemetry');
    }
    if (
      !data.behavioralIntent ||
      typeof data.behavioralIntent.action !== 'string' ||
      typeof data.behavioralIntent.timestamp !== 'number'
    ) {
      throw new Error('Invalid BehavioralIntent');
    }
  }

  private serializeData(data: RealityReceiptData): string {
    return JSON.stringify(this.sortObject(data));
  }

  private sortObject(val: any): any {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.sortObject(item));
    }
    const sortedKeyObject: any = {};
    Object.keys(val)
      .sort()
      .forEach((key) => {
        sortedKeyObject[key] = this.sortObject(val[key]);
      });
    return sortedKeyObject;
  }
}

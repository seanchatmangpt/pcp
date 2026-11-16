import { ImmuneResponse } from './ImmuneResponse';

export interface ChaosConfig {
  frequency: number; // 0 to 1, probability of chaos injection per cycle
  enabled: boolean;
}

export type CorruptionTarget = 'MMKV_STATE' | 'SYNC_PACKET' | 'PROPS';

export class ChaosInjector {
  private config: ChaosConfig;
  private immuneResponse: ImmuneResponse;

  constructor(
    config: ChaosConfig = { frequency: 0.01, enabled: true },
    immuneResponse: ImmuneResponse
  ) {
    this.config = config;
    this.immuneResponse = immuneResponse;
  }

  public cycle(targetData?: any, targetType?: CorruptionTarget): any {
    if (!this.config.enabled || Math.random() > this.config.frequency) {
      return targetData;
    }

    const target = targetType || this.randomTarget();
    let corruptedData: any = targetData;

    switch (target) {
      case 'MMKV_STATE':
        corruptedData = this.corruptMMKVState(targetData);
        break;
      case 'SYNC_PACKET':
        corruptedData = this.dropSyncPacket(targetData);
        break;
      case 'PROPS':
        corruptedData = this.injectMalformedProps(targetData);
        break;
    }

    this.immuneResponse.trigger(target, corruptedData);
    return corruptedData;
  }

  private randomTarget(): CorruptionTarget {
    const targets: CorruptionTarget[] = ['MMKV_STATE', 'SYNC_PACKET', 'PROPS'];
    return targets[Math.floor(Math.random() * targets.length)];
  }

  private corruptMMKVState(state: any): any {
    if (!state) return null;
    if (typeof state === 'object') {
      const keys = Object.keys(state);
      if (keys.length === 0) return { _corrupted: true };
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const newState = { ...state };
      newState[randomKey] = undefined; // Drop a random key
      return newState;
    }
    return null; // Corrupt primitives to null
  }

  private dropSyncPacket(packet: any): any {
    // Intentionally drop the packet
    return null;
  }

  private injectMalformedProps(props: any): any {
    if (!props) return { malformed: true };
    if (typeof props === 'object') {
      return {
        ...props,
        injectedProp: NaN,
        nested: { ...props.nested, dropped: true },
      };
    }
    return undefined; // Corrupt primitives to undefined
  }

  public setConfig(config: Partial<ChaosConfig>) {
    this.config = { ...this.config, ...config };
  }
}

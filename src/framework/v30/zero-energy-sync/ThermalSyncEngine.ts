export interface ThermalState {
  deviceTempCelsius: number;
  ambientTempCelsius: number;
}

export class ThermalSyncEngine {
  private baseConversionEfficiency: number;
  private energyBufferMicroJoules: number = 0;
  private readonly minimumEnergyRequired: number = 50.0;

  constructor(baseConversionEfficiency: number = 0.02) {
    this.baseConversionEfficiency = baseConversionEfficiency;
  }

  public harvestEnergy(state: ThermalState, durationSeconds: number): number {
    const deltaT = Math.abs(state.deviceTempCelsius - state.ambientTempCelsius);

    // Simplistic physics model for thermoelectric generation
    const powerMicroWatts = this.baseConversionEfficiency * Math.pow(deltaT, 2) * 1000;
    const harvested = powerMicroWatts * durationSeconds;

    this.energyBufferMicroJoules += harvested;
    return harvested;
  }

  public getEnergyBuffer(): number {
    return this.energyBufferMicroJoules;
  }

  public canTransmit(energyRequired: number): boolean {
    return this.energyBufferMicroJoules >= this.minimumEnergyRequired + energyRequired;
  }

  public consumeEnergy(amount: number): void {
    if (!this.canTransmit(amount)) {
      throw new Error('Insufficient thermal energy harvested');
    }
    this.energyBufferMicroJoules -= amount;
  }

  public modulateDeltaWithHeat(delta: string): number[] {
    const pulses: number[] = [];
    for (let i = 0; i < delta.length; i++) {
      pulses.push(delta.charCodeAt(i) * 0.1);
    }
    return pulses;
  }

  public demodulateHeatPulses(pulses: number[]): string {
    let result = '';
    for (const pulse of pulses) {
      const charCode = Math.round(pulse / 0.1);
      result += String.fromCharCode(charCode);
    }
    return result;
  }
}

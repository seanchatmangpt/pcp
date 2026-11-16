import { DeviceVitals } from './types';

export class FPSMonitor {
  private lastTime = 0;
  private frames = 0;
  private fps = 60;
  private rafId: number | null = null;

  start(onUpdate: (fps: number) => void) {
    this.lastTime = performance.now();
    const loop = () => {
      this.frames++;
      const now = performance.now();
      if (now >= this.lastTime + 1000) {
        this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
        onUpdate(this.fps);
        this.frames = 0;
        this.lastTime = now;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  getFPS() {
    return this.fps;
  }
}

export class DeviceMonitor {
  private batteryLevel = 1.0;
  private isCharging = true;
  private thermalState: DeviceVitals['thermalState'] = 'nominal';

  // In a real environment, these would be linked to native listeners
  // For this framework, we'll provide a way to update them
  updateVitals(vitals: Partial<Omit<DeviceVitals, 'fps'>>) {
    if (vitals.batteryLevel !== undefined) this.batteryLevel = vitals.batteryLevel;
    if (vitals.isCharging !== undefined) this.isCharging = vitals.isCharging;
    if (vitals.thermalState !== undefined) this.thermalState = vitals.thermalState;
  }

  getVitals(): Omit<DeviceVitals, 'fps'> {
    return {
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      thermalState: this.thermalState,
    };
  }
}

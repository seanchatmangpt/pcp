import { HookPackManifest } from './manifest';
import { HookPackRegistry } from './registry';

export class HookPackLoader {
  private registry: HookPackRegistry;

  constructor(registry: HookPackRegistry) {
    this.registry = registry;
  }

  public async load(manifest: HookPackManifest): Promise<void> {
    if (!manifest.name || !manifest.version) {
      throw new Error('Invalid manifest: missing name or version');
    }
    this.registry.register(manifest);
  }
}

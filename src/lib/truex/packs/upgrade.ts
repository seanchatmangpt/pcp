import { HookPackManifest } from './manifest';
import { HookPackRegistry } from './registry';

export class HookPackUpgrade {
  private registry: HookPackRegistry;

  constructor(registry: HookPackRegistry) {
    this.registry = registry;
  }

  public async upgrade(newManifest: HookPackManifest): Promise<boolean> {
    const existing = this.registry.get(newManifest.name);
    if (!existing) {
      this.registry.register(newManifest);
      return true;
    }
    console.log(`[Pack Upgrade] Upgrading ${newManifest.name} from v${existing.version} to v${newManifest.version}...`);
    this.registry.register(newManifest);
    return true;
  }
}

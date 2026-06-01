import { HookPackManifest } from './manifest';
import { HookPackRegistry } from './registry';

export class HookPackRollback {
  private registry: HookPackRegistry;

  constructor(registry: HookPackRegistry) {
    this.registry = registry;
  }

  public async rollback(name: string, targetVersion: string): Promise<boolean> {
    const existing = this.registry.get(name);
    if (!existing) {
      throw new Error(`Pack ${name} is not installed`);
    }
    console.log(`[Pack Rollback] Rolling back ${name} from v${existing.version} to v${targetVersion}...`);
    const updated: HookPackManifest = {
      ...existing,
      version: targetVersion,
    };
    this.registry.register(updated);
    return true;
  }
}

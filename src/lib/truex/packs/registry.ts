import { HookPackManifest } from './manifest';

export class HookPackRegistry {
  private packs = new Map<string, HookPackManifest>();

  public register(manifest: HookPackManifest): void {
    this.packs.set(manifest.name, manifest);
  }

  public get(name: string): HookPackManifest | undefined {
    return this.packs.get(name);
  }

  public remove(name: string): void {
    this.packs.delete(name);
  }

  public getAll(): HookPackManifest[] {
    return Array.from(this.packs.values());
  }

  public clear(): void {
    this.packs.clear();
  }
}

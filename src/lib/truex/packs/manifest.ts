export interface HookPackManifest {
  name: string;
  version: string;
  hooks: string[];
  supervisors: string[];
  migrations: string[];
}

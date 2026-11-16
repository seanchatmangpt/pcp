export class HookPackMigration {
  public async runMigration(name: string, migrationName: string): Promise<boolean> {
    console.log(`[Pack Migration] Running ${migrationName} for pack ${name}...`);
    return true;
  }
}

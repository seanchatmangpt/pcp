import * as fs from 'fs';
import * as path from 'path';

describe('Truex Expo Runtime Boundary Constraints', () => {
  const expoPaths = [
    'src/app',
    'src/components',
    'src/hooks',
    'src/route-law',
  ];

  const forbiddenTokens = [
    '@wasm4pm/',
    'WasmLoader',
    'SERVICE_ROLE_KEY',
    'receipt.authority = "server"',
    'writeAuthoritativeReceipt',
  ];

  function getPath(rel: string): string {
    return path.resolve(process.cwd(), rel);
  }

  function scanDirectory(dir: string, failures: string[]) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(fullPath, failures);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx'))
      ) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const token of forbiddenTokens) {
          if (content.includes(token)) {
            failures.push(`Violation in ${fullPath}: contains "${token}"`);
          }
        }
      }
    }
  }

  test('Expo files must not contain forbidden server/wasm tokens', () => {
    const failures: string[] = [];

    // Scan directories
    for (const p of expoPaths) {
      scanDirectory(getPath(p), failures);
    }

    // Scan specific root config files
    const configFiles = ['metro.config.js', 'app.json'];
    for (const file of configFiles) {
      const fullPath = getPath(file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const token of forbiddenTokens) {
          if (content.includes(token)) {
            failures.push(`Violation in config ${file}: contains "${token}"`);
          }
        }
      }
    }

    if (failures.length > 0) {
      console.error(failures.join('\n'));
    }
    expect(failures.length).toBe(0);
  });
});

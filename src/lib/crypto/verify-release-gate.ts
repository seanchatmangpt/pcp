import * as fs from 'fs';

/**
 * Verifies a proof manifest to ensure it is valid and contains no mock/stub flags.
 * Used as a gatekeeper to prevent mock/stub verification results from being released.
 */
export function verifyReleaseGate(manifestPath: string): void {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Proof manifest file not found: ${manifestPath}`);
  }

  let content: string;
  try {
    content = fs.readFileSync(manifestPath, 'utf8');
  } catch (err: any) {
    throw new Error(`Failed to read proof manifest file: ${err.message}`);
  }

  let manifest: any;
  try {
    manifest = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Failed to parse proof manifest JSON: ${err.message}`);
  }

  const forbiddenValues = ['VerifierPipelineSmoke'];

  function checkValue(val: any, path: string = ''): void {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      if (forbiddenValues.includes(val)) {
        throw new Error(`Forbidden mock/stub value "${val}" found`);
      }
    } else if (typeof val === 'object') {
      if (Array.isArray(val)) {
        val.forEach((item, index) => checkValue(item, `${path}[${index}]`));
      } else {
        Object.keys(val).forEach((key) => {
          const lowerKey = key.toLowerCase();
          const isMockOrStubKey = lowerKey.includes('mock') || lowerKey.includes('stub');
          const value = val[key];
          
          if (isMockOrStubKey) {
            if (typeof value === 'boolean' && value === true) {
              throw new Error(`Forbidden boolean flag "${key}" is set to true`);
            }
            if (typeof value === 'string' && value !== '') {
              throw new Error(`Forbidden string flag "${key}" is set to "${value}"`);
            }
          }
          checkValue(value, path ? `${path}.${key}` : key);
        });
      }
    }
  }

  checkValue(manifest);
}

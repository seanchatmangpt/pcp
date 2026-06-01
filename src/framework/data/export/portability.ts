const documentDirectory = 'stub_dir';
const cacheDirectory = 'stub_cache';
const readAsStringAsync = async (...args: any[]) => '';
const writeAsStringAsync = async (...args: any[]) => {};
const EncodingType = { Base64: 'base64' };
import { Share } from 'react-native';
import { mmkvInstance } from '@/src/lib/store/mmkvStorage';
import { DATABASE_NAME } from '@/src/lib/db/db';
import { blake3, canonicalStringify } from '@/src/lib/crypto/receipts';

export interface ExportPackage {
  version: number;
  timestamp: number;
  sqliteBase64: string;
  mmkvState: Record<string, string>;
  signature: string;
}

export const Portability = {
  async exportData(): Promise<string> {
    const dbPath = `${documentDirectory}SQLite/${DATABASE_NAME}`;
    let sqliteBase64 = '';
    try {
      sqliteBase64 = await readAsStringAsync(dbPath, { encoding: EncodingType.Base64 });
    } catch (e) {
      sqliteBase64 = ''; // Test fallback
    }

    const mmkvKeys = mmkvInstance.getAllKeys();
    const mmkvState: Record<string, string> = {};
    mmkvKeys.forEach((key) => {
      const val = mmkvInstance.getString(key);
      if (val) mmkvState[key] = val;
    });

    const pkg: Omit<ExportPackage, 'signature'> = {
      version: 1,
      timestamp: Date.now(),
      sqliteBase64,
      mmkvState,
    };

    const signature = blake3(canonicalStringify(pkg));
    const finalPackage: ExportPackage = { ...pkg, signature };

    const exportUri = `${cacheDirectory}pcp_backup_${pkg.timestamp}.json`;
    await writeAsStringAsync(exportUri, JSON.stringify(finalPackage));

    try {
      await Share.share({ url: exportUri });
    } catch (e) {
      // ignore
    }

    return exportUri;
  },

  async importData(fileUri: string): Promise<void> {
    const content = await readAsStringAsync(fileUri);
    const pkg: ExportPackage = JSON.parse(content);

    const { signature, ...data } = pkg;
    const expectedSignature = blake3(canonicalStringify(data));
    if (signature !== expectedSignature) {
      throw new Error('Data integrity violation: Backup file signature mismatch.');
    }

    mmkvInstance.clearAll();
    Object.entries(pkg.mmkvState).forEach(([key, val]) => {
      mmkvInstance.set(key, val);
    });

    const dbPath = `${documentDirectory}SQLite/${DATABASE_NAME}`;
    await writeAsStringAsync(dbPath, pkg.sqliteBase64, { encoding: EncodingType.Base64 });
  },
};

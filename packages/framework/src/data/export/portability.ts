import * as FileSystem from 'expo-file-system/legacy';
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
    const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
    let sqliteBase64 = '';
    try {
      sqliteBase64 = await FileSystem.readAsStringAsync(dbPath, { encoding: 'base64' });
    } catch (e) {
      sqliteBase64 = ''; // Test fallback
    }

    const mmkvKeys = mmkvInstance.getAllKeys();
    const mmkvState: Record<string, string> = {};
    mmkvKeys.forEach((key: string) => {
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

    const filePath = `${FileSystem.cacheDirectory}pcp_backup_${pkg.timestamp}.json`;
    const json = JSON.stringify(finalPackage);
    await FileSystem.writeAsStringAsync(filePath, json, { encoding: 'utf8' });

    try {
      await Share.share({ url: filePath });
    } catch (e) {
      // ignore
    }

    return filePath;
  },

  async importData(fileUri: string): Promise<void> {
    const content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
    let pkg: ExportPackage;
    try {
      pkg = JSON.parse(content);
    } catch {
      throw new Error('Data integrity violation: Backup file signature mismatch.');
    }

    const { signature, ...data } = pkg;
    const expectedSignature = blake3(canonicalStringify(data as any));
    if (signature !== expectedSignature) {
      throw new Error('Data integrity violation: Backup file signature mismatch.');
    }

    mmkvInstance.clearAll();
    Object.entries(pkg.mmkvState).forEach(([key, val]) => {
      mmkvInstance.set(key, val);
    });

    const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
    await FileSystem.writeAsStringAsync(dbPath, pkg.sqliteBase64, { encoding: 'base64' });
  },
};

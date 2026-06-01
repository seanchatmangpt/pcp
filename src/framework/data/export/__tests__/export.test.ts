import { renderHook, act } from '@testing-library/react-native';
import { useDataPortability } from '../useDataPortability';
import { Portability } from '../portability';
import * as FileSystem from 'expo-file-system';
import { Share } from 'react-native';
import { DATABASE_NAME } from '@/src/lib/db/db';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://doc/',
  cacheDirectory: 'file://cache/',
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock('../../../../lib/crypto/receipts', () => ({
  blake3: jest.fn().mockReturnValue('mock-sig'),
  canonicalStringify: jest.fn().mockReturnValue('{}'),
}));

describe('Data Export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Share, 'share')
      .mockImplementation(() => Promise.resolve({ action: Share.sharedAction } as any));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports data correctly', async () => {
    const { result } = renderHook(() => useDataPortability());

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('base64db');

    let uri;
    await act(async () => {
      uri = await result.current.exportData();
    });

    expect(uri).toContain('pcp_backup_');
  });

  it('imports data correctly', async () => {
    const { result } = renderHook(() => useDataPortability());

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        timestamp: 123,
        sqliteBase64: 'base64',
        mmkvState: { key: 'val' },
        signature: 'mock-sig',
      })
    );

    await act(async () => {
      await result.current.importData('file://test.json');
    });

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      `file://doc/SQLite/${DATABASE_NAME}`,
      'base64',
      { encoding: 'base64' }
    );
  });

  it('fails import on signature mismatch', async () => {
    const { result } = renderHook(() => useDataPortability());

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        timestamp: 123,
        sqliteBase64: 'base64',
        mmkvState: { key: 'val' },
        signature: 'bad-sig',
      })
    );

    await expect(async () => {
      await act(async () => {
        await result.current.importData('file://test.json');
      });
    }).rejects.toThrow('Data integrity violation: Backup file signature mismatch.');
  });
});

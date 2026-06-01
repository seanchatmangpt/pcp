import { useState } from 'react';
import { Portability } from './portability';

export function useDataPortability() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    try {
      return await Portability.exportData();
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async (uri: string) => {
    setIsImporting(true);
    try {
      await Portability.importData(uri);
    } finally {
      setIsImporting(false);
    }
  };

  return { exportData, importData, isExporting, isImporting };
}

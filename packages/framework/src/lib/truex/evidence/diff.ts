export interface ReplayDiffMismatch {
  type: 'state' | 'delta';
  path: string;
  expected: any;
  observed: any;
}

export interface ReplayDiffReport {
  diverged: boolean;
  mismatches: ReplayDiffMismatch[];
}

export function computeDiff(expected: any, observed: any): ReplayDiffReport {
  const mismatches: ReplayDiffMismatch[] = [];

  function compare(exp: any, obs: any, currentPath: string) {
    if (exp === obs) return;

    if (typeof exp !== typeof obs) {
      mismatches.push({
        type: 'state',
        path: currentPath,
        expected: typeof exp,
        observed: typeof obs,
      });
      return;
    }

    if (typeof exp === 'object' && exp !== null && obs !== null) {
      const expKeys = Object.keys(exp);
      const obsKeys = Object.keys(obs);

      const allKeys = new Set([...expKeys, ...obsKeys]);
      for (const key of allKeys) {
        compare(exp[key], obs[key], currentPath ? `${currentPath}.${key}` : key);
      }
    } else {
      mismatches.push({
        type: 'state',
        path: currentPath,
        expected: exp,
        observed: obs,
      });
    }
  }

  compare(expected, observed, '');

  return {
    diverged: mismatches.length > 0,
    mismatches,
  };
}

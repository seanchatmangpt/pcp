import { LWWMap } from '../map';

describe('LWWMap', () => {
  it('should set and get values', () => {
    const map = new LWWMap<string>('p1');
    map.set('key1', 'val1');
    expect(map.get('key1')).toBe('val1');
  });

  it('should merge correctly', () => {
    const m1 = new LWWMap<string>('p1');
    m1.set('key1', 'v1');

    const m2State = {
      key1: { value: 'v2', timestamp: Date.now() + 1000, peerId: 'p2' },
      key2: { value: 'v3', timestamp: Date.now(), peerId: 'p2' },
    };

    m1.merge(m2State);
    expect(m1.get('key1')).toBe('v2');
    expect(m1.get('key2')).toBe('v3');
  });

  it('should handle local deletions', () => {
    const map = new LWWMap<string>('p1');
    map.set('key1', 'val1');
    map.delete('key1');
    expect(map.get('key1')).toBeUndefined();
  });
});

import { SemanticNodeCache } from '../cache';
import { DataFactory } from '../rdf';

describe('SemanticNodeCache', () => {
  it('sets and gets cached quads', () => {
    const cache = new SemanticNodeCache();
    const uri = 'http://example.com/s';
    const q = DataFactory.quad(
      DataFactory.namedNode(uri),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );

    cache.set(uri, [q]);
    const res = cache.get(uri);

    expect(res).toEqual([q]);
  });

  it('supports Term objects as keys', () => {
    const cache = new SemanticNodeCache();
    const uri = DataFactory.namedNode('http://example.com/s');
    const q = DataFactory.quad(
      uri,
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );

    cache.set(uri, [q]);
    const res = cache.get(uri);

    expect(res).toEqual([q]);
  });

  it('expires items after TTL', () => {
    jest.useFakeTimers();
    const cache = new SemanticNodeCache(1000);
    const uri = 'http://example.com/s';

    cache.set(uri, []);
    expect(cache.get(uri)).toEqual([]);

    jest.advanceTimersByTime(1001);

    expect(cache.get(uri)).toBeNull();
    jest.useRealTimers();
  });
});

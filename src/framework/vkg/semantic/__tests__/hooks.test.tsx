import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSemanticQuery, useSemanticMatch } from '../hooks';
import { DataFactory } from '../../rdf';
import { NS } from '../types';

const mockClient = {
  match: jest.fn(),
  addQuads: jest.fn(),
  removeQuads: jest.fn(),
  jsonLdToQuads: jest.fn(),
  quadsToJsonLd: jest.fn(),
  getSyncEngine: jest.fn(),
  addJsonLd: jest.fn(),
} as any;

describe('useSemanticQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes a query and returns results', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode(NS.schema + 'name'),
      DataFactory.literal('Alice')
    );
    mockClient.match.mockResolvedValue([q]);

    const { result } = renderHook(() =>
      useSemanticQuery(mockClient, (query) => {
        query.match('http://s', 'schema:name', '?name').select('?name');
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].name.value).toBe('Alice');
  });

  it('handles errors in semantic query', async () => {
    mockClient.match.mockRejectedValue(new Error('Query failed'));

    const { result } = renderHook(() =>
      useSemanticQuery(mockClient, (query) => {
        query.match('?s', 'schema:name', '?o');
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error?.message).toBe('Query failed');
  });
});

describe('useSemanticMatch', () => {
  it('executes a simple match via hook', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );
    mockClient.match.mockResolvedValue([q]);

    const { result } = renderHook(() => useSemanticMatch(mockClient, 'http://s', 'http://p'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.results[0].o.value).toBe('http://o');
  });

  it('executes match with object but no subject', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );
    mockClient.match.mockResolvedValue([q]);

    const { result } = renderHook(() => useSemanticMatch(mockClient, null, 'http://p', 'http://o'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.results[0].s.value).toBe('http://s');
  });
});

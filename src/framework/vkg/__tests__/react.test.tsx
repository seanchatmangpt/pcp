import React from 'react';
import { View } from 'react-native';
import { render, screen, renderHook, waitFor } from '@testing-library/react-native';
import { VkgProvider, useVkg, useGraphTraversal } from '../react';
import { DataFactory } from '../rdf';

// We mock the base implementation to ensure our facade correctly wraps and delegates.
jest.mock('../../../components/VkgProvider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    VkgProvider: ({ children }: { children: React.ReactNode }) => (
      <View testID="base-provider">{children}</View>
    ),
    useVkgEngine: () => ({ isMockEngine: true }),
  };
});

describe('VKG Framework - React Context', () => {
  it('renders the VkgProvider wrapper', () => {
    render(
      <VkgProvider>
        <View testID="child" />
      </VkgProvider>
    );

    expect(screen.getByTestId('base-provider')).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('useVkg correctly aliases useVkgEngine', () => {
    let contextValue;

    const TestComponent = () => {
      contextValue = useVkg();
      return <View testID="hook-consumer" />;
    };

    render(<TestComponent />);

    expect(screen.getByTestId('hook-consumer')).toBeTruthy();
    expect(contextValue).toEqual({ isMockEngine: true });
  });
});

describe('useGraphTraversal', () => {
  const mockClient = {
    match: jest.fn(),
    addQuads: jest.fn(),
    removeQuads: jest.fn(),
    jsonLdToQuads: jest.fn(),
    quadsToJsonLd: jest.fn(),
    getSyncEngine: jest.fn(),
    addJsonLd: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data on mount', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );

    mockClient.match.mockResolvedValue([q]);

    const { result } = renderHook(() => useGraphTraversal(mockClient, 'http://s', 'http://p'));

    expect(result.current.loading).toBe(true);
    expect(result.current.objects).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.objects).toEqual([DataFactory.namedNode('http://o')]);
    expect(result.current.error).toBeNull();
  });

  it('handles errors', async () => {
    const err = new Error('Match failed');
    mockClient.match.mockRejectedValue(err);

    const { result } = renderHook(() => useGraphTraversal(mockClient, 'http://s', 'http://p'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(err);
    expect(result.current.objects).toEqual([]);
  });

  it('does not update state if unmounted before resolution', async () => {
    let resolveMatch: any;
    mockClient.match.mockImplementation(() => {
      return new Promise((resolve) => {
        resolveMatch = resolve;
      });
    });

    const { result, unmount } = renderHook(() =>
      useGraphTraversal(mockClient, 'http://s', 'http://p')
    );

    unmount();
    resolveMatch([]);

    // Wait a bit to ensure the promise resolves
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.loading).toBe(true);
  });

  it('does not update state if unmounted before rejection', async () => {
    let rejectMatch: any;
    mockClient.match.mockImplementation(() => {
      return new Promise((_, reject) => {
        rejectMatch = reject;
      });
    });

    const { result, unmount } = renderHook(() =>
      useGraphTraversal(mockClient, 'http://s', 'http://p')
    );

    unmount();
    rejectMatch(new Error('fail'));

    // Wait a bit to ensure the promise resolves
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('supports Term objects as arguments', async () => {
    const q = DataFactory.quad(
      DataFactory.namedNode('http://s'),
      DataFactory.namedNode('http://p'),
      DataFactory.namedNode('http://o')
    );

    mockClient.match.mockResolvedValue([q]);

    const { result } = renderHook(() =>
      useGraphTraversal(
        mockClient,
        DataFactory.namedNode('http://s'),
        DataFactory.namedNode('http://p')
      )
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.objects).toEqual([DataFactory.namedNode('http://o')]);
  });
});

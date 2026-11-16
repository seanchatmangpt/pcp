import React from 'react';
import { View } from 'react-native';
import { render, screen, renderHook, waitFor } from '@testing-library/react-native';
import { VkgProvider, useVkg, useGraphTraversal } from '../react';
import { DataFactory } from '../rdf';

// Facade VkgProvider is tested directly with self-contained VkgContext.

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
});

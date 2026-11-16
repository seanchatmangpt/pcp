import React from 'react';
import { renderHook, act, render } from '@testing-library/react-native';
import {
  useQuantumState,
  Observer,
  WaveFunctionCollapseError,
  ZeroProbabilityError,
  Superposition,
} from '../index';
import { Text } from 'react-native';

describe('Non-Euclidean Data Structures: useQuantumState', () => {
  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random');
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  const getInitialSuperposition = (): Superposition<string> => [
    { value: 'Dead', probability: 0.5 },
    { value: 'Alive', probability: 0.5 },
  ];

  it('initializes in superposition (uncollapsed)', () => {
    const { result } = renderHook(() => useQuantumState(getInitialSuperposition()));

    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.superposition).toEqual(getInitialSuperposition());
    expect(() => result.current.getDeterministicValue()).toThrow(WaveFunctionCollapseError);
  });

  it('collapses into a deterministic state based on probabilities (First Value)', () => {
    const { result } = renderHook(() => useQuantumState(getInitialSuperposition()));

    mathRandomSpy.mockReturnValue(0.2); // Selects first element (0.2 * 1.0 = 0.2 <= 0.5)

    let collapsedValue: string;
    act(() => {
      collapsedValue = result.current.collapse();
    });

    expect(result.current.isCollapsed).toBe(true);
    expect(collapsedValue!).toBe('Dead');
    expect(result.current.getDeterministicValue()).toBe('Dead');
  });

  it('collapses into a deterministic state based on probabilities (Second Value)', () => {
    const { result } = renderHook(() => useQuantumState(getInitialSuperposition()));

    mathRandomSpy.mockReturnValue(0.8); // Selects second element (0.8 * 1.0 = 0.8 > 0.5)

    let collapsedValue: string;
    act(() => {
      collapsedValue = result.current.collapse();
    });

    expect(result.current.isCollapsed).toBe(true);
    expect(collapsedValue!).toBe('Alive');
    expect(result.current.getDeterministicValue()).toBe('Alive');
  });
});

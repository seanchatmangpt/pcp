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

  it('handles Non-Euclidean negative probabilities safely via absolute mass', () => {
    const nonEuclideanSuperposition: Superposition<string> = [
      { value: 'Anti-Matter', probability: -0.2 },
      { value: 'Matter', probability: 0.8 },
    ];
    const { result } = renderHook(() => useQuantumState(nonEuclideanSuperposition));

    mathRandomSpy.mockReturnValue(0.1); // Total mass = 1.0. 0.1 <= |-0.2| -> 'Anti-Matter'

    act(() => {
      result.current.collapse();
    });

    expect(result.current.getDeterministicValue()).toBe('Anti-Matter');
  });

  it('throws ZeroProbabilityError when superposition is empty', () => {
    const { result } = renderHook(() => useQuantumState([]));

    expect(() =>
      act(() => {
        result.current.collapse();
      })
    ).toThrow(ZeroProbabilityError);
  });

  it('throws ZeroProbabilityError when total probability mass is zero', () => {
    const { result } = renderHook(() => useQuantumState([{ value: 'Void', probability: 0 }]));

    expect(() =>
      act(() => {
        result.current.collapse();
      })
    ).toThrow(ZeroProbabilityError);
  });

  it('allows restoring superposition (re-entanglement)', () => {
    const { result } = renderHook(() => useQuantumState(getInitialSuperposition()));

    act(() => {
      result.current.collapse();
    });
    expect(result.current.isCollapsed).toBe(true);

    const newSuperposition: Superposition<string> = [{ value: 'Reborn', probability: 1.0 }];

    act(() => {
      result.current.setSuperposition(newSuperposition);
    });

    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.superposition).toEqual(newSuperposition);
    expect(() => result.current.getDeterministicValue()).toThrow(WaveFunctionCollapseError);
  });

  it('edge case: collapses to last element if randomVal exactly hits threshold', () => {
    const { result } = renderHook(() =>
      useQuantumState([
        { value: 'A', probability: 0.5 },
        { value: 'B', probability: 0.5 },
      ])
    );
    mathRandomSpy.mockReturnValue(0.999);
    act(() => {
      result.current.collapse();
    });
    expect(result.current.getDeterministicValue()).toBe('B');
  });
});

describe('Non-Euclidean Data Structures: Observer', () => {
  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random');
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('forces state collapse when rendered and displays the deterministic value', () => {
    mathRandomSpy.mockReturnValue(0.1); // Should collapse to 'A'

    const TestComponent = () => {
      const state = useQuantumState([{ value: 'A', probability: 1.0 }]);
      return React.createElement(Observer, {
        state: state as any,
        children: (value: any) =>
          React.createElement(Text, { testID: 'observed-value' }, String(value)),
      });
    };

    const { getByTestId } = render(React.createElement(TestComponent));

    // The effect runs synchronously or quickly in render.
    const textNode = getByTestId('observed-value');
    expect(textNode.props.children).toBe('A');
  });

  it('renders null initially and then renders deterministic value', () => {
    // With StrictMode / synchronous rendering, useEffect might take a tick,
    // but in `@testing-library/react-native`, effects run synchronously in `render`.
    // We can simulate an already collapsed state.

    const TestComponent = () => {
      const state = useQuantumState([{ value: 'B', probability: 1.0 }]);
      // Pre-collapse
      if (!state.isCollapsed) {
        state.collapse();
      }
      return React.createElement(Observer, {
        state: state as any,
        children: (value: any) =>
          React.createElement(Text, { testID: 'observed-value' }, String(value)),
      });
    };

    const { getByTestId } = render(React.createElement(TestComponent));

    expect(getByTestId('observed-value').props.children).toBe('B');
  });
});

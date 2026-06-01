import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ExperimentConfig } from '../types';
import { createMMKV } from 'react-native-mmkv';

// Now import the components
import { ExperimentProvider, useExperiment, Experiment, Variant } from '../index';

const storage = createMMKV({ id: 'pcp-ab-testing' });
const mockSet = jest.spyOn(storage, 'set');
const mockGetString = jest.spyOn(storage, 'getString');

const testConfigs: ExperimentConfig[] = [
  {
    id: 'test-experiment',
    variants: ['A', 'B'],
    weights: [0.5, 0.5],
  },
  {
    id: 'weighted-experiment',
    variants: ['control', 'test'],
    weights: [0, 1], // Always test
  },
  {
    id: 'non-sticky-experiment',
    variants: ['X', 'Y'],
    sticky: false,
  },
];

describe('A/B Testing Framework', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ExperimentProvider', () => {
    it('should assign variants from storage if available', () => {
      mockGetString.mockImplementation((id: string) => {
        if (id === 'test-experiment') return 'B';
        return undefined;
      });

      const TestComponent = () => {
        const { variant } = useExperiment('test-experiment');
        return <Text>{variant}</Text>;
      };

      render(
        <ExperimentProvider configs={testConfigs}>
          <TestComponent />
        </ExperimentProvider>
      );

      expect(screen.getByText('B')).toBeTruthy();
      expect(mockSet).not.toHaveBeenCalledWith('test-experiment', expect.any(String));
    });

    it('should assign new variants and persist them if not in storage', () => {
      mockGetString.mockReturnValue(undefined);
      // Mock Math.random to get predictable results
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.7);

      const TestComponent = () => {
        const { variant } = useExperiment('test-experiment');
        return <Text>{variant}</Text>;
      };

      render(
        <ExperimentProvider configs={testConfigs}>
          <TestComponent />
        </ExperimentProvider>
      );

      // 0.7 > 0.5, so it should be variant 'B'
      expect(screen.getByText('B')).toBeTruthy();
      expect(mockSet).toHaveBeenCalledWith('test-experiment', 'B');

      spy.mockRestore();
    });

    it('should honor weighted distribution', () => {
      mockGetString.mockReturnValue(undefined);

      const TestComponent = () => {
        const { variant } = useExperiment('weighted-experiment');
        return <Text>{variant}</Text>;
      };

      render(
        <ExperimentProvider configs={testConfigs}>
          <TestComponent />
        </ExperimentProvider>
      );

      // weights are [0, 1], so it should always be 'test'
      expect(screen.getByText('test')).toBeTruthy();
      expect(mockSet).toHaveBeenCalledWith('weighted-experiment', 'test');
    });

    it('should not persist non-sticky experiments', () => {
      mockGetString.mockReturnValue(undefined);

      render(
        <ExperimentProvider configs={testConfigs}>
          <Text>Empty</Text>
        </ExperimentProvider>
      );

      expect(mockSet).not.toHaveBeenCalledWith('non-sticky-experiment', expect.any(String));
    });

    it('should throw error if useExperiment is used outside provider', () => {
      const TestComponent = () => {
        useExperiment('test-experiment');
        return null;
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestComponent />)).toThrow(
        'useExperimentContext must be used within an ExperimentProvider'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('useExperiment hook', () => {
    it('should return variant, setVariant, and config', () => {
      mockGetString.mockReturnValue('A');

      let captured: any;
      const TestComponent = () => {
        captured = useExperiment('test-experiment');
        return null;
      };

      render(
        <ExperimentProvider configs={testConfigs}>
          <TestComponent />
        </ExperimentProvider>
      );

      expect(captured.variant).toBe('A');
      expect(typeof captured.setVariant).toBe('function');
      expect(captured.config).toEqual(testConfigs[0]);
    });

    it('should update variant via setVariant', () => {
      mockGetString.mockReturnValue('A');

      const TestComponent = () => {
        const { variant, setVariant } = useExperiment('test-experiment');
        return (
          <>
            <Text>{variant}</Text>
            <Text testID="btn" onPress={() => setVariant('B')}>
              Change
            </Text>
          </>
        );
      };

      const { getByTestId } = render(
        <ExperimentProvider configs={testConfigs}>
          <TestComponent />
        </ExperimentProvider>
      );

      expect(screen.getByText('A')).toBeTruthy();

      act(() => {
        getByTestId('btn').props.onPress();
      });

      expect(screen.getByText('B')).toBeTruthy();
      expect(mockSet).toHaveBeenCalledWith('test-experiment', 'B');
    });

    it('should throw error for undefined experiment', () => {
      const TestComponent = () => {
        useExperiment('unknown-experiment');
        return null;
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        render(
          <ExperimentProvider configs={testConfigs}>
            <TestComponent />
          </ExperimentProvider>
        )
      ).toThrow('Experiment "unknown-experiment" was not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Experiment Components', () => {
    it('should render the correct Variant component', () => {
      mockGetString.mockReturnValue('B');

      render(
        <ExperimentProvider configs={testConfigs}>
          <Experiment id="test-experiment">
            <Variant name="A">
              <Text>Component A</Text>
            </Variant>
            <Variant name="B">
              <Text>Component B</Text>
            </Variant>
          </Experiment>
        </ExperimentProvider>
      );

      expect(screen.queryByText('Component A')).toBeNull();
      expect(screen.getByText('Component B')).toBeTruthy();
    });

    it('should render nothing if no variant matches', () => {
      const customConfigs: ExperimentConfig[] = [{ id: 'custom', variants: ['A', 'B', 'C'] }];
      mockGetString.mockReturnValue('C');

      const { toJSON } = render(
        <ExperimentProvider configs={customConfigs}>
          <Experiment id="custom">
            <Variant name="A">
              <Text>A</Text>
            </Variant>
            <Variant name="B">
              <Text>B</Text>
            </Variant>
          </Experiment>
        </ExperimentProvider>
      );

      expect(toJSON()).toBeNull();
    });

    it('should ignore non-Variant children in Experiment', () => {
      mockGetString.mockReturnValue('A');

      render(
        <ExperimentProvider configs={testConfigs}>
          <Experiment id="test-experiment">
            <Variant name="A">
              <Text>A</Text>
            </Variant>
            <Text>Some other text</Text>
          </Experiment>
        </ExperimentProvider>
      );

      expect(screen.getByText('A')).toBeTruthy();
      expect(screen.queryByText('Some other text')).toBeNull();
    });
  });
});

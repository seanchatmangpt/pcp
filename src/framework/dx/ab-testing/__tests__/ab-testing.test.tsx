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
  });
});

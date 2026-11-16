import React from 'react';
import { View, Text, Button } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import { useNeuralIntent, SensorData } from '../useNeuralIntent';
import { BciBoundary } from '../BciBoundary';

// A helper component to test the hook
function HookTestComponent({ config }: { config?: any }) {
  const { intent, injectData, resetIntent } = useNeuralIntent(config);

  return (
    <View>
      <Text testID="intent">{intent}</Text>
      <Button
        testID="inject-select"
        title="Inject Select"
        onPress={() => {
          // High Gamma + High fNIRS
          for (let i = 0; i < 6; i++) {
            injectData({
              eegAlpha: 0.1,
              eegBeta: 0.1,
              eegGamma: 0.9,
              fnirsO2: 0.6,
              timestamp: Date.now(),
            });
          }
        }}
      />

      <Button
        testID="inject-scroll-down"
        title="Inject Scroll Down"
        onPress={() => {
          // High Beta
          for (let i = 0; i < 6; i++) {
            injectData({
              eegAlpha: 0.1,
              eegBeta: 0.8,
              eegGamma: 0.1,
              fnirsO2: 0.1,
              timestamp: Date.now(),
            });
          }
        }}
      />

      <Button
        testID="inject-scroll-up"
        title="Inject Scroll Up"
        onPress={() => {
          // High Alpha
          for (let i = 0; i < 6; i++) {
            injectData({
              eegAlpha: 0.7,
              eegBeta: 0.1,
              eegGamma: 0.1,
              fnirsO2: 0.1,
              timestamp: Date.now(),
            });
          }
        }}
      />

      <Button
        testID="inject-back"
        title="Inject Back"
        onPress={() => {
          // Low overall
          for (let i = 0; i < 6; i++) {
            injectData({
              eegAlpha: 0.1,
              eegBeta: 0.1,
              eegGamma: 0.1,
              fnirsO2: 0.1,
              timestamp: Date.now(),
            });
          }
        }}
      />

      <Button
        testID="inject-artifact"
        title="Inject Artifact"
        onPress={() => {
          // Artifacts
          injectData({
            eegAlpha: 3.0,
            eegBeta: 3.0,
            eegGamma: 3.0,
            fnirsO2: 1.0,
            timestamp: Date.now(),
          });
        }}
      />

      <Button
        testID="inject-single"
        title="Inject Single"
        onPress={() => {
          injectData({
            eegAlpha: 0.5,
            eegBeta: 0.5,
            eegGamma: 0.5,
            fnirsO2: 0.5,
            timestamp: Date.now(),
          });
        }}
      />

      <Button
        testID="inject-none"
        title="Inject None"
        onPress={() => {
          for (let i = 0; i < 6; i++) {
            injectData({
              eegAlpha: 0.5,
              eegBeta: 0.5,
              eegGamma: 0.5,
              fnirsO2: 0.5,
              timestamp: Date.now(),
            });
          }
        }}
      />

      <Button testID="reset" title="Reset" onPress={resetIntent} />
    </View>
  );
}

describe('useNeuralIntent', () => {
  it('should initialize with NONE intent', () => {
    const { getByTestId } = render(<HookTestComponent />);
    expect(getByTestId('intent').props.children).toBe('NONE');
  });

  it('should not change intent if buffer is not full', () => {
    const { getByTestId } = render(<HookTestComponent />);
    act(() => {
      fireEvent.press(getByTestId('inject-single'));
    });
    expect(getByTestId('intent').props.children).toBe('NONE');
  });

  it('should detect SELECT intent', () => {
    const { getByTestId } = render(<HookTestComponent />);
    act(() => {
      fireEvent.press(getByTestId('inject-select'));
    });
    expect(getByTestId('intent').props.children).toBe('SELECT');
  });
});

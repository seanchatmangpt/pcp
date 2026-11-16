import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Button, View, Text } from 'react-native';
import {
  useSemanticFuzzer,
  GenerativeUI,
  generateParadoxicalState,
  safeStringify,
} from '../useSemanticFuzzer';

const TestComponent = () => {
  const { fuzzedState, triggerFuzz, resolveGracefully } = useSemanticFuzzer();

  return (
    <View>
      <Button testID="fuzz-button" title="Fuzz" onPress={triggerFuzz} />
      <Button
        testID="resolve-button-alpha"
        title="Resolve Alpha"
        onPress={() => resolveGracefully('node:alpha')}
      />
      <Button
        testID="resolve-button-nonexistent"
        title="Resolve Nonexistent"
        onPress={() => resolveGracefully('node:nonexistent')}
      />
      <GenerativeUI state={fuzzedState} />
    </View>
  );
};

describe('Neuro-Symbolic Fuzzer', () => {
  it('should initialize empty', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('empty-ui')).toBeTruthy();
  });

  it('should generate paradoxical states and render them without crashing', () => {
    render(<TestComponent />);

    act(() => {
      fireEvent.press(screen.getByTestId('fuzz-button'));
    });

    expect(screen.getByTestId('generative-ui')).toBeTruthy();
    expect(screen.getByTestId('node-node:alpha')).toBeTruthy();
    expect(screen.getByTestId('node-node:beta')).toBeTruthy();
  });

  it('should resolve paradoxical state gracefully', () => {
    render(<TestComponent />);

    act(() => {
      fireEvent.press(screen.getByTestId('fuzz-button'));
    });

    const alphaNode = screen.getByTestId('node-node:alpha');
    expect(alphaNode.props.children[1].props.children).toContain('Circular Reference to Unknown');

    act(() => {
      fireEvent.press(screen.getByTestId('resolve-button-alpha'));
    });

    const resolvedAlphaNode = screen.getByTestId('node-node:alpha');
    expect(resolvedAlphaNode.props.children[1].props.children).not.toContain(
      'Circular Reference to Unknown'
    );
    expect(resolvedAlphaNode.props.children[1].props.children).toContain('node:beta');
  });
});

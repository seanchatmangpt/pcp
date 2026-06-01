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

  it('should not throw or crash when resolving a non-existent node', () => {
    render(<TestComponent />);
    act(() => {
      fireEvent.press(screen.getByTestId('fuzz-button'));
    });

    act(() => {
      fireEvent.press(screen.getByTestId('resolve-button-nonexistent'));
    });

    const alphaNode = screen.getByTestId('node-node:alpha');
    expect(alphaNode.props.children[1].props.children).toContain('Circular Reference to Unknown');
  });

  it('should not throw when resolving when state is null', () => {
    render(<TestComponent />);

    act(() => {
      fireEvent.press(screen.getByTestId('resolve-button-alpha'));
    });

    expect(screen.getByTestId('empty-ui')).toBeTruthy();
  });

  it('generateParadoxicalState should return expected data', () => {
    const state = generateParadoxicalState();
    expect(state.length).toBe(2);
    expect(state[0].id).toBe('node:alpha');
    expect(state[1].id).toBe('node:beta');
  });

  it('safeStringify should handle circular references gracefully', () => {
    const obj: any = { a: 1 };
    obj.self = obj;

    const result = safeStringify(obj);
    expect(result).toContain('Circular Reference to Unknown');

    const objWithId: any = { id: 'test-id', a: 1 };
    objWithId.self = objWithId;
    const resultWithId = safeStringify(objWithId);
    expect(resultWithId).toContain('Circular Reference to test-id');
  });

  it('GenerativeUI gracefully catches unexpected JSON.stringify errors', () => {
    const throwNode = {
      id: 'node:throw',
      type: 'schema:Error',
      get properties() {
        throw new Error('Unexpected Error');
      },
    };

    const state: any = [throwNode];

    render(<GenerativeUI state={state} />);
    expect(screen.getByTestId('node-node:throw')).toBeTruthy();
    expect(screen.getByText('CIRCULAR_REFERENCE_ERROR')).toBeTruthy();
  });
});

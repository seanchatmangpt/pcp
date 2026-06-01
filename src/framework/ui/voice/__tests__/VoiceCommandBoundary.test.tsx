import React from 'react';
import { render } from '@testing-library/react-native';
import { VoiceCommandBoundary, useVoiceContext } from '../VoiceCommandBoundary';
import { Text } from 'react-native';

const TestComponent = () => {
  const { activeIntents } = useVoiceContext();
  return <Text testID="intent-count">{activeIntents.length}</Text>;
};

describe('VoiceCommandBoundary', () => {
  it('provides context to children', () => {
    const { getByTestId } = render(
      <VoiceCommandBoundary>
        <TestComponent />
      </VoiceCommandBoundary>
    );
    expect(getByTestId('intent-count').children[0]).toBe('0');
  });

  it('initializes with intents', () => {
    const initialIntents = [{ id: 'test', commands: ['test'], action: () => {} }];
    const { getByTestId } = render(
      <VoiceCommandBoundary intents={initialIntents}>
        <TestComponent />
      </VoiceCommandBoundary>
    );
    expect(getByTestId('intent-count').children[0]).toBe('1');
  });

  it('renders overlay when listening', () => {
    const Overlay = () => <Text testID="overlay">Listening...</Text>;

    // Testing overlay through a component that uses the hook to start listening
    const ListeningComponent = () => {
      const { setIsListening } = useVoiceContext();
      React.useEffect(() => {
        setIsListening(true);
      }, [setIsListening]);
      return <Text>Content</Text>;
    };

    const { getByTestId } = render(
      <VoiceCommandBoundary overlay={<Overlay />}>
        <ListeningComponent />
      </VoiceCommandBoundary>
    );
    expect(getByTestId('overlay')).toBeTruthy();
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      'useVoiceContext must be used within a VoiceCommandBoundary'
    );
    consoleSpy.mockRestore();
  });
});

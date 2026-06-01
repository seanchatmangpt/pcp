import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly with default props', () => {
    const { getByText } = render(<Button>Default Button</Button>);
    expect(getByText('Default Button')).toBeTruthy();
  });

  it('renders correctly with different variants', () => {
    const { getByText } = render(<Button variant="primary">Primary Button</Button>);
    expect(getByText('Primary Button')).toBeTruthy();
  });

  it('renders correctly with different sizes', () => {
    const { getByText } = render(<Button size="lg">Large Button</Button>);
    expect(getByText('Large Button')).toBeTruthy();
  });

  it('handles onPress', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(<Button onPress={onPressMock}>Press Me</Button>);
    fireEvent.press(getByText('Press Me'));
    expect(onPressMock).toHaveBeenCalled();
  });

  it('shows loading state and disables button', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button isLoading onPress={onPressMock}>
        Loading Button
      </Button>
    );
    expect(getByText('Loading...')).toBeTruthy();
    expect(getByText('Loading Button')).toBeTruthy();

    // In React Native Testing Library, finding the wrapping component to check disabled prop is sometimes tricky.
    // The easiest way is to fire a press and check if it was called.
    // Wait, the AnimatedPressable might still propagate to the text. We check if onPress was not called.
    fireEvent.press(getByText('Loading Button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('handles onPressIn and onPressOut to trigger animations', () => {
    const onPressInMock = jest.fn();
    const onPressOutMock = jest.fn();
    const { getByText } = render(
      <Button onPressIn={onPressInMock} onPressOut={onPressOutMock}>
        Animated Button
      </Button>
    );

    const button = getByText('Animated Button');
    fireEvent(button, 'pressIn');
    expect(onPressInMock).toHaveBeenCalled();

    fireEvent(button, 'pressOut');
    expect(onPressOutMock).toHaveBeenCalled();
  });
  it('renders children correctly when they are React nodes', () => {
    const { getByTestId } = render(
      <Button>
        <Text testID="custom-child">Custom Child</Text>
      </Button>
    );
    expect(getByTestId('custom-child')).toBeTruthy();
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Stagger } from '../Stagger';
import { FadeIn } from '../FadeIn';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

describe('Stagger', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <Stagger>
        <Text>Item 1</Text>
        <Text>Item 2</Text>
      </Stagger>
    );
    expect(getByText('Item 1')).toBeTruthy();
    expect(getByText('Item 2')).toBeTruthy();
  });

  it('injects delay into children', () => {
    const MockChild = ({ delay, testID }: any) => <Text testID={testID}>{delay}</Text>;

    const { getByTestId } = render(
      <Stagger stagger={100} initialDelay={50}>
        <MockChild testID="child-0" />
        <MockChild testID="child-1" />
      </Stagger>
    );

    expect(getByTestId('child-0').props.children).toBe(50);
    expect(getByTestId('child-1').props.children).toBe(150);
  });
});

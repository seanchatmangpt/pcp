import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import { ConfettiCannon } from '../ConfettiCannon';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.runOnJS = (fn: any) => fn;
  return Reanimated;
});

describe('ConfettiCannon', () => {
  it('renders correctly with default props', () => {
    const { toJSON } = render(<ConfettiCannon />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders at specific origin', () => {
    const origin = { x: 100, y: 200 };
    const { toJSON } = render(
      <View>
        <ConfettiCannon origin={origin} />
      </View>
    );
    expect(toJSON()).toBeTruthy();
  });
});

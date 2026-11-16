import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FadeIn } from '../FadeIn';
import { ScalePress } from '../ScalePress';
import { SlideTransition } from '../SlideTransition';
import { Stagger } from '../Stagger';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.createAnimatedComponent = (component: any) => component;
  return Reanimated;
});

describe('Consolidated Animations Tests', () => {
  // --- FadeIn ---
  describe('FadeIn', () => {
    it('renders children correctly', () => {
      const { getByText } = render(
        <FadeIn>
          <Text>Fade Me In</Text>
        </FadeIn>
      );
      expect(getByText('Fade Me In')).toBeTruthy();
    });

    it('applies custom style', () => {
      const { getByTestId } = render(
        <FadeIn testID="fade-in" style={{ marginTop: 10 }}>
          <Text>Fade Me In</Text>
        </FadeIn>
      );
      const element = getByTestId('fade-in');
      expect(element.props.style).toContainEqual({ marginTop: 10 });
    });
  });

  // --- ScalePress ---
  describe('ScalePress', () => {
    it('renders children correctly', () => {
      const { getByText } = render(
        <ScalePress>
          <Text>Press Me</Text>
        </ScalePress>
      );
      expect(getByText('Press Me')).toBeTruthy();
    });

    it('handles onPress event', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <ScalePress onPress={onPress}>
          <Text>Press Me</Text>
        </ScalePress>
      );
      fireEvent.press(getByText('Press Me'));
      expect(onPress).toHaveBeenCalled();
    });

    it('applies custom container style', () => {
      const { getByTestId } = render(
        <ScalePress testID="scale-press" containerStyle={{ backgroundColor: 'red' }}>
          <Text>Press Me</Text>
        </ScalePress>
      );
      const element = getByTestId('scale-press');
      expect(element.props.style).toContainEqual({ backgroundColor: 'red' });
    });
  });

  // --- SlideTransition ---
  describe('SlideTransition', () => {
    it('renders children correctly', () => {
      const { getByText } = render(
        <SlideTransition>
          <Text>Slide Me</Text>
        </SlideTransition>
      );
      expect(getByText('Slide Me')).toBeTruthy();
    });

    it('applies custom style', () => {
      const { getByTestId } = render(
        <SlideTransition testID="slide-transition" style={{ padding: 20 }}>
          <Text>Slide Me</Text>
        </SlideTransition>
      );
      const element = getByTestId('slide-transition');
      expect(element.props.style).toContainEqual({ padding: 20 });
    });
  });

  // --- Stagger ---
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
});

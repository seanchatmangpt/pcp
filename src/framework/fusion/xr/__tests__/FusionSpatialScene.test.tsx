import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text, Platform } from 'react-native';
import { FusionSpatialScene } from '../FusionSpatialScene';

// Mock dependencies
jest.mock('../../../xr/spatial/SpatialView', () => {
  const { View } = require('react-native');
  return {
    SpatialView: ({ children, transform, depth }: any) => (
      <View testID="spatial-view" data-transform={JSON.stringify(transform)} data-depth={depth}>
        {children}
      </View>
    ),
  };
});

jest.mock('../../../ui/glassmorphism/GlassCard', () => {
  const { View } = require('react-native');
  return {
    GlassCard: ({ children, intensity, tint, style, ...props }: any) => (
      <View
        testID="glass-card"
        data-intensity={intensity}
        data-tint={tint}
        style={style}
        {...props}
      >
        {children}
      </View>
    ),
  };
});

jest.mock('../../../ui/animations/Stagger', () => {
  const { View } = require('react-native');
  return {
    Stagger: ({ children, stagger, style }: any) => (
      <View testID="stagger" data-stagger={stagger} style={style}>
        {children}
      </View>
    ),
  };
});

jest.mock('../../../ui/animations/FadeIn', () => {
  const { View } = require('react-native');
  return {
    FadeIn: ({ children, delay, duration, style }: any) => (
      <View testID="fade-in" data-delay={delay} data-duration={duration} style={style}>
        {children}
      </View>
    ),
  };
});

// Helper to mock Platform
const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    get: () => os,
    configurable: true,
  });
};

describe('FusionSpatialScene', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    setPlatform(originalOS);
    jest.clearAllMocks();
  });

  const children = [
    <Text key="1">Item 1</Text>,
    <Text key="2">Item 2</Text>,
    <Text key="3">Item 3</Text>,
  ];

  describe('2D Rendering (iOS/Android)', () => {
    beforeEach(() => {
      setPlatform('ios');
    });

    it('renders a 2D grid of glass cards', () => {
      const { getAllByTestId, getByTestId, getByText } = render(
        <FusionSpatialScene>{children}</FusionSpatialScene>
      );

      expect(getByTestId('stagger')).toBeTruthy();
      const fadeIns = getAllByTestId('fade-in');
      expect(fadeIns).toHaveLength(3);

      const glassCards = getAllByTestId('glass-card');
      expect(glassCards).toHaveLength(3);

      expect(getByText('Item 1')).toBeTruthy();
      expect(getByText('Item 2')).toBeTruthy();
      expect(getByText('Item 3')).toBeTruthy();
    });

    it('applies correct grid widths based on columns', () => {
      const { getAllByTestId } = render(
        <FusionSpatialScene columns={2}>{children}</FusionSpatialScene>
      );

      const fadeIns = getAllByTestId('fade-in');
      expect(fadeIns[0].props.style).toContainEqual({ width: '50%', padding: 8 });
    });

    it('passes intensity and tint to GlassCard in 2D', () => {
      const { getAllByTestId } = render(
        <FusionSpatialScene intensity="high" tint="light">
          {children}
        </FusionSpatialScene>
      );

      const glassCards = getAllByTestId('glass-card');
      expect(glassCards[0].props['data-intensity']).toBe('high');
      expect(glassCards[0].props['data-tint']).toBe('light');
    });
  });
});

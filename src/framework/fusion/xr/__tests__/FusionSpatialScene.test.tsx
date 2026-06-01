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
        {...props}>
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

  describe('3D Rendering (VisionOS)', () => {
    beforeEach(() => {
      setPlatform('visionos');
    });

    it('renders spatial views in 3D mode', () => {
      const { getAllByTestId } = render(<FusionSpatialScene>{children}</FusionSpatialScene>);

      const spatialViews = getAllByTestId('spatial-view');
      expect(spatialViews).toHaveLength(3);

      const glassCards = getAllByTestId('glass-card');
      expect(glassCards).toHaveLength(3);
    });

    it('calculates carousel positions correctly', () => {
      const { getAllByTestId } = render(
        <FusionSpatialScene layout="carousel" radius={5}>
          {children}
        </FusionSpatialScene>
      );

      const spatialViews = getAllByTestId('spatial-view');

      // Item 0: angle 0 => x=0, z=-5
      const transform0 = JSON.parse(spatialViews[0].props['data-transform']);
      expect(transform0.position.x).toBeCloseTo(0);
      expect(transform0.position.z).toBeCloseTo(-5);

      // Item 1: angle 2pi/3 => x=sin(2pi/3)*5, z=-cos(2pi/3)*5
      const transform1 = JSON.parse(spatialViews[1].props['data-transform']);
      expect(transform1.position.x).toBeCloseTo(Math.sin((2 * Math.PI) / 3) * 5);
      expect(transform1.position.z).toBeCloseTo(-Math.cos((2 * Math.PI) / 3) * 5);
    });

    it('calculates dashboard positions correctly', () => {
      const { getAllByTestId } = render(
        <FusionSpatialScene layout="dashboards" radius={3}>
          {children}
        </FusionSpatialScene>
      );

      const spatialViews = getAllByTestId('spatial-view');
      expect(spatialViews).toHaveLength(3);

      // Should be spread in an arc
      const t0 = JSON.parse(spatialViews[0].props['data-transform']);
      const t1 = JSON.parse(spatialViews[1].props['data-transform']);
      const t2 = JSON.parse(spatialViews[2].props['data-transform']);

      expect(t0.position.x).toBeLessThan(0);
      expect(t1.position.x).toBeCloseTo(0);
      expect(t2.position.x).toBeGreaterThan(0);
    });

    it('calculates dashboard positions correctly with single child', () => {
      const { getAllByTestId } = render(
        <FusionSpatialScene layout="dashboards" radius={3}>
          {[<Text key="1">Only Item</Text>]}
        </FusionSpatialScene>
      );

      const spatialViews = getAllByTestId('spatial-view');
      expect(spatialViews).toHaveLength(1);

      const t0 = JSON.parse(spatialViews[0].props['data-transform']);
      expect(t0.position.x).toBeCloseTo(0);
      expect(t0.position.z).toBeCloseTo(-3);
    });

    it('detects spatial mode for "xr" platform', () => {
      setPlatform('xr');
      const { queryAllByTestId } = render(<FusionSpatialScene>{children}</FusionSpatialScene>);
      expect(queryAllByTestId('spatial-view')).toHaveLength(3);
    });

    it('calculates grid positions in 3D', () => {
      const { getAllByTestId } = render(
        <FusionSpatialScene layout="grid" columns={2}>
          {children}
        </FusionSpatialScene>
      );

      const spatialViews = getAllByTestId('spatial-view');

      const t0 = JSON.parse(spatialViews[0].props['data-transform']);
      const t1 = JSON.parse(spatialViews[1].props['data-transform']);
      const t2 = JSON.parse(spatialViews[2].props['data-transform']);

      // Row 0: Items 0, 1
      expect(t0.position.y).toEqual(t1.position.y);
      expect(t0.position.x).toBeLessThan(t1.position.x);

      // Row 1: Item 2
      expect(t2.position.y).toBeLessThan(t0.position.y);
    });
  });

  describe('Common Functionality', () => {
    it('honors isSpatial prop regardless of platform', () => {
      setPlatform('ios');
      const { queryAllByTestId } = render(
        <FusionSpatialScene isSpatial={true}>{children}</FusionSpatialScene>
      );
      expect(queryAllByTestId('spatial-view')).toHaveLength(3);

      setPlatform('visionos');
      const { queryAllByTestId: queryAll2D } = render(
        <FusionSpatialScene isSpatial={false}>{children}</FusionSpatialScene>
      );
      expect(queryAll2D('stagger')).toHaveLength(1);
    });

    it('sets displayName correctly', () => {
      expect(FusionSpatialScene.displayName).toBe('FusionSpatialScene');
    });
  });
});

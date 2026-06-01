import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { GlassSpatialContainer } from '../GlassSpatialContainer';

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
    GlassCard: ({ children, intensity, tint, withBorder, style, ...props }: any) => (
      <View
        testID="glass-card"
        data-intensity={intensity}
        data-tint={tint}
        data-with-border={withBorder}
        style={style}
        {...props}>
        {children}
      </View>
    ),
  };
});

jest.mock('../../../ui/animations/SlideTransition', () => {
  const { View } = require('react-native');
  return {
    SlideTransition: ({ children, direction, delay }: any) => (
      <View testID="slide-transition" data-direction={direction} data-delay={delay}>
        {children}
      </View>
    ),
  };
});

jest.mock('../../../ui/animations/FadeIn', () => {
  const { View } = require('react-native');
  return {
    FadeIn: ({ children, delay }: any) => (
      <View testID="fade-in" data-delay={delay}>
        {children}
      </View>
    ),
  };
});

describe('GlassSpatialContainer', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <GlassSpatialContainer>
        <Text>Test Content</Text>
      </GlassSpatialContainer>
    );
    expect(getByText('Test Content')).toBeTruthy();
  });

  it('applies default props', () => {
    const { getByTestId } = render(
      <GlassSpatialContainer>
        <Text>Content</Text>
      </GlassSpatialContainer>
    );

    const spatialView = getByTestId('spatial-view');
    const glassCard = getByTestId('glass-card');
    const slideTransition = getByTestId('slide-transition');

    expect(spatialView.props['data-depth']).toBe(0);
    expect(glassCard.props['data-intensity']).toBe('medium');
    expect(glassCard.props['data-tint']).toBe('default');
    expect(glassCard.props['data-with-border']).toBe(true);
    expect(slideTransition.props['data-direction']).toBe('up');
    expect(slideTransition.props['data-delay']).toBe(0);
  });

  it('passes custom props correctly', () => {
    const transform = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 45, z: 0 },
      scale: { x: 2, y: 2, z: 2 },
    };
    const style = { margin: 10 };

    const { getByTestId } = render(
      <GlassSpatialContainer
        transform={transform}
        depth={5}
        intensity="high"
        tint="light"
        withBorder={false}
        delay={500}
        entryDirection="left"
        style={style}>
        <Text>Content</Text>
      </GlassSpatialContainer>
    );

    const spatialView = getByTestId('spatial-view');
    const glassCard = getByTestId('glass-card');
    const slideTransition = getByTestId('slide-transition');

    expect(spatialView.props['data-transform']).toBe(JSON.stringify(transform));
    expect(spatialView.props['data-depth']).toBe(5);
    expect(glassCard.props['data-intensity']).toBe('high');
    expect(glassCard.props['data-tint']).toBe('light');
    expect(glassCard.props['data-with-border']).toBe(false);
    expect(glassCard.props.style).toEqual(style);
    expect(slideTransition.props['data-direction']).toBe('left');
    expect(slideTransition.props['data-delay']).toBe(500);
  });

  it('uses FadeIn when fadeOnly is true', () => {
    const { queryByTestId, getByTestId } = render(
      <GlassSpatialContainer fadeOnly delay={300}>
        <Text>Content</Text>
      </GlassSpatialContainer>
    );

    expect(queryByTestId('slide-transition')).toBeNull();
    const fadeIn = getByTestId('fade-in');
    expect(fadeIn.props['data-delay']).toBe(300);
    expect(getByTestId('glass-card')).toBeTruthy();
  });

  it('uses SlideTransition when fadeOnly is false', () => {
    const { queryByTestId, getByTestId } = render(
      <GlassSpatialContainer fadeOnly={false}>
        <Text>Content</Text>
      </GlassSpatialContainer>
    );

    expect(queryByTestId('fade-in')).toBeNull();
    expect(getByTestId('slide-transition')).toBeTruthy();
  });

  it('passes additional props to GlassCard', () => {
    const { getByTestId } = render(
      <GlassSpatialContainer accessibilityLabel="spatial-card">
        <Text>Content</Text>
      </GlassSpatialContainer>
    );

    const glassCard = getByTestId('glass-card');
    expect(glassCard.props.accessibilityLabel).toBe('spatial-card');
  });

  it('sets displayName correctly', () => {
    expect(GlassSpatialContainer.displayName).toBe('GlassSpatialContainer');
  });
});

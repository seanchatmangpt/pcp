import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { useAnimatedSensor, SensorType } from 'react-native-reanimated';
import { HolographicContainer, useHolographicContext } from '../HolographicContainer';
import { HolographicGlassCard } from '../HolographicGlassCard';
import { useHolographicSensors } from '../useHolographicSensors';

// Mock react-native-reanimated's useAnimatedSensor hook
jest.mock('react-native-reanimated', () => {
  const reanimated = jest.requireActual('react-native-reanimated/mock');
  return {
    ...reanimated,
    useAnimatedSensor: jest.fn(),
    useAnimatedStyle: (updater: () => any) => updater(),
    interpolate: (value: number, input: number[], output: number[]) => {
      // Simple linear interpolation mock for testing
      const [inMin, inMax] = input;
      const [outMin, outMax] = output;
      if (inMax === inMin) return outMin;
      const progress = (value - inMin) / (inMax - inMin);
      return outMin + progress * (outMax - outMin);
    },
    Extrapolation: {
      CLAMP: 'clamp',
    },
  };
});

// Mock GlassCard component from ui/glassmorphism since it contains sub-components
jest.mock('../../../ui/glassmorphism/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children, style, testID, ...props }: any) => (
      <View testID={testID || 'glass-card'} style={style} {...props}>
        {children}
      </View>
    ),
  };
});

describe('Holographic Module', () => {
  const mockSensorValue = {
    roll: 0.2, // Rotation around X axis
    pitch: -0.3, // Rotation around Y axis
    yaw: 0.1, // Rotation around Z axis
  };

  const mockSensor = {
    sensor: {
      value: mockSensorValue,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnimatedSensor as jest.Mock).mockReturnValue(mockSensor);
  });

  describe('useHolographicSensors', () => {
    it('calls useAnimatedSensor with ROTATION and interval', () => {
      const result = useHolographicSensors();
      expect(useAnimatedSensor).toHaveBeenCalledWith(SensorType.ROTATION, { interval: 16 });
      expect(result).toBe(mockSensor);
    });
  });

  describe('HolographicContainer', () => {
    it('provides sensor data to descendants when enabled', () => {
      const Consumer = () => {
        const sensor = useHolographicContext();
        return (
          <Text testID="sensor-status">
            {sensor ? `active:${sensor.sensor.value.roll}` : 'inactive'}
          </Text>
        );
      };

      const { getByTestId } = render(
        <HolographicContainer isEnabled={true}>
          <Consumer />
        </HolographicContainer>
      );

      const status = getByTestId('sensor-status');
      expect(status.props.children).toBe('active:0.2');
    });

    it('provides null to descendants when disabled', () => {
      const Consumer = () => {
        const sensor = useHolographicContext();
        return <Text testID="sensor-status">{sensor ? 'active' : 'inactive'}</Text>;
      };

      const { getByTestId } = render(
        <HolographicContainer isEnabled={false}>
          <Consumer />
        </HolographicContainer>
      );

      const status = getByTestId('sensor-status');
      expect(status.props.children).toBe('inactive');
    });
  });

  describe('HolographicGlassCard', () => {
    it('applies parallax translations and tilts based on sensor data', () => {
      const { getByTestId } = render(
        <HolographicContainer isEnabled={true}>
          <HolographicGlassCard testID="holographic-card" parallaxIntensity={20}>
            <Text>Card Content</Text>
          </HolographicGlassCard>
        </HolographicContainer>
      );

      const card = getByTestId('holographic-card');

      // The child is the parallax content layer (second child in HolographicGlassCard after glare layer)
      const contentLayer = card.props.children[1];
      expect(contentLayer.props.style).toBeDefined();

      const style = contentLayer.props.style[1]; // animatedStyle is at index 1
      expect(style.transform).toBeDefined();

      // Expected translateX:
      // roll = 0.2
      // input range [-Math.PI/4, Math.PI/4] => [-0.785, 0.785]
      // output range [20, -20]
      // progress of 0.2 in [-0.785, 0.785] is (0.2 - (-0.785)) / (1.57) = ~0.627
      // output = 20 + 0.627 * (-40) = 20 - 25.08 = -5.08
      const translateXObj = style.transform.find((t: any) => t.translateX !== undefined);
      const translateYObj = style.transform.find((t: any) => t.translateY !== undefined);
      const rotateXObj = style.transform.find((t: any) => t.rotateX !== undefined);
      const rotateYObj = style.transform.find((t: any) => t.rotateY !== undefined);

      expect(translateXObj.translateX).toBeLessThan(0); // roll is positive, should move left (negative translateX)
      expect(translateYObj.translateY).toBeGreaterThan(0); // pitch is negative, should move down (positive translateY)
      expect(rotateXObj.rotateX.startsWith('-0.03')).toBe(true); // pitch * 0.1
      expect(rotateYObj.rotateY.startsWith('0.02')).toBe(true); // roll * 0.1
    });

    it('inverts the translation when inverted prop is true', () => {
      const { getByTestId } = render(
        <HolographicContainer isEnabled={true}>
          <HolographicGlassCard testID="holographic-card" inverted={true}>
            <Text>Card Content</Text>
          </HolographicGlassCard>
        </HolographicContainer>
      );

      const card = getByTestId('holographic-card');
      const contentLayer = card.props.children[1];
      const style = contentLayer.props.style[1];

      const translateXObj = style.transform.find((t: any) => t.translateX !== undefined);
      expect(translateXObj.translateX).toBeGreaterThan(0); // roll is positive, but inverted so should be positive
    });

    it('renders with empty style when no sensor context is provided', () => {
      const { getByTestId } = render(
        <HolographicGlassCard testID="holographic-card">
          <Text>No Context Card</Text>
        </HolographicGlassCard>
      );

      const card = getByTestId('holographic-card');
      const contentLayer = card.props.children[1];
      const style = contentLayer.props.style[1];
      expect(style).toEqual({});
    });
  });
});

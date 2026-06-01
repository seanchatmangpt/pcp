import React, { useMemo, useEffect } from 'react';
import { StyleSheet, View, ColorValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  useDerivedValue,
  SharedValue,
} from 'react-native-reanimated';
import { ParticleEmitterProps } from './types';

const DEFAULT_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

interface ParticleConfig {
  id: string;
  vx: number;
  vy: number;
  rotationSpeed: number;
  size: number;
  color: ColorValue;
  initialRotation: number;
}

const ParticleItem: React.FC<{
  config: ParticleConfig;
  progress: SharedValue<number>;
  gravity: number;
}> = ({ config, progress, gravity }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    // Basic physics: s = ut + 0.5at^2
    // We scale t by a factor to make it look good in pixels/ms
    const timeScale = 100;
    const px = config.vx * t * timeScale;
    const py = config.vy * t * timeScale + 0.5 * gravity * Math.pow(t * timeScale, 2);

    return {
      transform: [
        { translateX: px },
        { translateY: py },
        { rotate: `${config.initialRotation + config.rotationSpeed * t * 10}deg` },
      ],
      opacity: 1 - t, // Fade out
      backgroundColor: config.color,
      width: config.size,
      height: config.size,
      position: 'absolute',
    };
  });

  return <Animated.View style={animatedStyle} />;
};

/**
 * High-performance Particle Emitter.
 * Uses a single SharedValue to drive multiple particles on the UI thread.
 */
export const ParticleEmitter: React.FC<ParticleEmitterProps> = ({
  count = 50,
  colors = DEFAULT_COLORS,
  gravity = 0.5,
  velocityRange = { min: -5, max: 5 },
  sizeRange = { min: 4, max: 10 },
  duration = 2000,
  autoStart = true,
  onComplete,
}) => {
  const progress = useSharedValue(0);

  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: `particle-${i}`,
      vx: Math.random() * (velocityRange.max - velocityRange.min) + velocityRange.min,
      vy: Math.random() * (velocityRange.max - velocityRange.min) + velocityRange.min - 5, // Bias upwards
      rotationSpeed: Math.random() * 360,
      size: Math.random() * (sizeRange.max - sizeRange.min) + sizeRange.min,
      color: colors[Math.floor(Math.random() * colors.length)],
      initialRotation: Math.random() * 360,
    }));
  }, [count, colors, velocityRange, sizeRange]);

  useEffect(() => {
    if (autoStart) {
      progress.value = withTiming(
        1,
        {
          duration,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        }
      );
    }
  }, [autoStart, duration, onComplete, progress]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p) => (
        <ParticleItem key={p.id} config={p} progress={progress} gravity={gravity} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Relative to parent
    alignItems: 'center',
    justifyContent: 'center',
  },
});

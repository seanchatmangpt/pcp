import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ParticleEmitter } from './ParticleEmitter';
import { ConfettiCannonProps } from './types';

/**
 * A specialized confetti cannon component.
 * Ideal for celebrating form submissions or major achievements.
 */
export const ConfettiCannon: React.FC<ConfettiCannonProps> = ({
  count = 100,
  colors = [
    '#f44336',
    '#e91e63',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#2196f3',
    '#03a9f4',
    '#00bcd4',
    '#009688',
    '#4caf50',
    '#8bc34a',
    '#cddc39',
    '#ffeb3b',
    '#ffc107',
    '#ff9800',
    '#ff5722',
  ],
  gravity = 0.6,
  velocityRange = { min: -10, max: 10 },
  sizeRange = { min: 6, max: 12 },
  duration = 3000,
  autoStart = true,
  onComplete,
  origin,
  shape = 'mixed',
}) => {
  // Use a container that can be positioned
  const containerStyle = origin
    ? {
        left: origin.x,
        top: origin.y,
      }
    : styles.center;

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrapper]} pointerEvents="none">
      <View style={[styles.originContainer, containerStyle]}>
        <ParticleEmitter
          count={count}
          colors={colors}
          gravity={gravity}
          velocityRange={velocityRange}
          sizeRange={sizeRange}
          duration={duration}
          autoStart={autoStart}
          onComplete={onComplete}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 9999,
  },
  originContainer: {
    position: 'absolute',
  },
  center: {
    left: '50%',
    top: '50%',
  },
});

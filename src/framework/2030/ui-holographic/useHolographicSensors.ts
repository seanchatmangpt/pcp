import { useAnimatedSensor, SensorType } from 'react-native-reanimated';

/**
 * A hook that provides smoothed gyroscope/accelerometer data for holographic effects.
 * It uses Reanimated's specialized sensor hooks for high-performance UI updates.
 */
export const useHolographicSensors = () => {
  // Use ROTATION sensor which combines multiple physical sensors for stable orientation
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });

  return sensor;
};

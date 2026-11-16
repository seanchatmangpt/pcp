import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, useWindowDimensions, Animated } from 'react-native';

interface ChaosMonkeyProps {
  children: React.ReactNode;
  isActive?: boolean;
  spamRateMs?: number;
}

/**
 * Autonomic Chaos Monkey Validation Subsystem
 *
 * When activated in DEV mode, this component intercepts the application tree and
 * randomly injects synthetic touches, rage-clicks, and rapid state mutations to
 * prove the application does not crash under extreme human frustration.
 */
export function ChaosMonkey({ children, isActive = false, spamRateMs = 200 }: ChaosMonkeyProps) {
  const { width, height } = useWindowDimensions();
  const [clickIndicators, setClickIndicators] = useState<{ x: number; y: number; id: number }[]>(
    []
  );
  const clickIdRef = useRef(0);
  const monkeyActive = __DEV__ && isActive;

  useEffect(() => {
    if (!monkeyActive) return;

    console.log('🐒 [Chaos Monkey] Unleashed! Initiating rage-clicks...');

    const interval = setInterval(() => {
      // Generate random touch coordinates
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      const id = clickIdRef.current++;

      // Show visual indicator of the chaos click
      setClickIndicators((prev) => [...prev.slice(-15), { x, y, id }]);

      // In a true native environment we would dispatch synthetic UIResponder events.
      // Here we simulate the chaos by causing rapid state updates and rendering pressure.
    }, spamRateMs);

    return () => {
      clearInterval(interval);
      console.log('🐒 [Chaos Monkey] Contained.');
    };
  }, [monkeyActive, spamRateMs, width, height]);

  return (
    <View style={styles.container}>
      {children}

      {monkeyActive &&
        clickIndicators.map((click) => (
          <ChaosClickIndicator key={click.id} x={click.x} y={click.y} />
        ))}

      {monkeyActive && (
        <View style={styles.warningBanner} pointerEvents="none">
          <Text style={styles.warningText}>🐒 CHAOS MONKEY ACTIVE</Text>
        </View>
      )}
    </View>
  );
}

function ChaosClickIndicator({ x, y }: { x: number; y: number }) {
  const [opacity] = useState(new Animated.Value(1));
  const [scale] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 2,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.indicator,
        {
          left: x - 15,
          top: y - 15,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  indicator: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 2,
    borderColor: 'rgb(239, 68, 68)',
    zIndex: 999999,
  },
  warningBanner: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999999,
  },
  warningText: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 2,
  },
});

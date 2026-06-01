import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';

export interface TransitionOverlayProps {
  isTransitioning: boolean;
  transitionType?: 'signin' | 'signout' | string | null;
  colorScheme?: 'light' | 'dark' | null;
}

export function TransitionOverlay({
  isTransitioning,
  transitionType,
  colorScheme,
}: TransitionOverlayProps) {
  const [visible, setVisible] = useState(false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    if (isTransitioning) {
      setVisible(true);
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 15, stiffness: 100 });
    } else {
      opacity.value = withTiming(0, { duration: 350 }, (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
        }
      });
      scale.value = withSpring(0.95, { damping: 15, stiffness: 100 });
    }

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [isTransitioning]);

  const animatedOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  if (!visible) return null;

  const isSignIn = transitionType === 'signin';
  const isDark = colorScheme === 'dark';

  return (
    <Animated.View
      pointerEvents={isTransitioning ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        animatedOverlayStyle,
        {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(248, 250, 252, 0.85)',
          zIndex: 9999,
          justifyContent: 'center',
          alignItems: 'center',
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={
        isSignIn
          ? 'Welcome back! Securing session & preparing your workspace'
          : 'Signing out... Clearing session cache & returning to login'
      }
      accessibilityLiveRegion="assertive">
      <Animated.View
        style={[
          animatedContentStyle,
          {
            width: '100%',
            alignItems: 'center',
          },
        ]}>
        <View
          className={`items-center p-8 rounded-3xl shadow-2xl border ${
            isDark
              ? 'bg-slate-900 border-slate-700 shadow-slate-900'
              : 'bg-white border-slate-200 shadow-slate-300'
          } w-[85%] max-w-[400px]`}>
          <View
            className={`rounded-full p-5 mb-5 ${isDark ? 'bg-slate-800' : 'bg-blue-50'} shadow-sm`}>
            <ActivityIndicator size="large" color={isDark ? '#60a5fa' : '#3b82f6'} />
          </View>
          <Text
            className={`text-2xl font-bold mb-3 text-center tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {isSignIn ? 'Welcome back!' : 'Signing out...'}
          </Text>
          <Text
            className={`text-base text-center leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {isSignIn
              ? 'Securing session & preparing your workspace'
              : 'Clearing session cache & returning to login'}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

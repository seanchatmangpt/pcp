import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  runOnJS,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';

export function OfflineBanner() {
  const networkOnline = useActorOpsStore((state) => state.networkOnline);
  const setNetworkOnline = useActorOpsStore((state) => state.setNetworkOnline);

  const [status, setStatus] = React.useState<'idle' | 'offline' | 'reconnecting' | 'connected'>(
    networkOnline ? 'idle' : 'offline'
  );

  const progress = useSharedValue(networkOnline ? 0 : 1);
  const pulseVal = useSharedValue(1);
  const rotateVal = useSharedValue(0);
  const successScaleVal = useSharedValue(0.3);

  const prevNetworkOnline = React.useRef(networkOnline);

  useEffect(() => {
    if (networkOnline && !prevNetworkOnline.current) {
      // Transition from offline/reconnecting to online
      setStatus('connected');

      // Animate success scale
      successScaleVal.value = 0.3;
      successScaleVal.value = withSpring(1, { damping: 5, stiffness: 100 });

      // Hold success state for 1500ms, then animate closed
      const timer = setTimeout(() => {
        progress.value = withTiming(0, { duration: 350 }, (finished) => {
          if (finished) {
            runOnJS(setStatus)('idle');
          }
        });
      }, 1500);

      return () => clearTimeout(timer);
    } else if (!networkOnline && prevNetworkOnline.current) {
      // Transition from online to offline
      setStatus('offline');
      progress.value = withTiming(1, { duration: 300 });
    }

    prevNetworkOnline.current = networkOnline;
  }, [networkOnline]);

  // Handle pulse animation for offline icon
  useEffect(() => {
    if (status === 'offline') {
      pulseVal.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        false
      );
    } else {
      pulseVal.value = 1;
    }
  }, [status]);

  // Handle rotation animation for reconnecting icon
  useEffect(() => {
    if (status === 'reconnecting') {
      rotateVal.value = 0;
      rotateVal.value = withRepeat(
        withTiming(1, { duration: 1000, easing: ReanimatedEasing.linear }),
        -1,
        false
      );
    } else {
      rotateVal.value = 0;
    }
  }, [status]);

  const handleReconnect = () => {
    if (status === 'offline') {
      setStatus('reconnecting');
      // Simulate/trigger reconnection to Truex Membrane
      setTimeout(() => {
        setNetworkOnline(true);
      }, 1200);
    }
  };

  const containerStyle = useAnimatedStyle(() => {
    const height = progress.value * 56;
    const opacity = progress.value;
    const translateY = (1 - progress.value) * -20;
    const borderBottomWidth = progress.value > 0.1 ? 1 : 0;
    return {
      height,
      opacity,
      borderBottomWidth,
      transform: [{ translateY }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseVal.value }],
    opacity: pulseVal.value,
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateVal.value * 360}deg` }],
  }));

  const successScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScaleVal.value }],
  }));

  if (status === 'idle') {
    return null;
  }

  const getAccessibilityLabel = () => {
    switch (status) {
      case 'offline':
        return 'Device Offline — Using Pre-Admission Tension Queue';
      case 'reconnecting':
        return 'Reconnecting to Truex Membrane';
      case 'connected':
        return 'Connection Restored';
      default:
        return '';
    }
  };

  return (
    <Animated.View
      testID="offline-banner"
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={getAccessibilityLabel()}
      style={[
        styles.bannerContainer,
        containerStyle,
        status === 'reconnecting' && styles.bannerContainerReconnecting,
        status === 'connected' && styles.bannerContainerConnected,
      ]}
    >
      <View style={styles.innerContainer}>
        {status === 'offline' && (
          <>
            <View style={styles.textAndIconContainer}>
              <Animated.View style={pulseStyle}>
                <Ionicons name="cloud-offline" size={16} color="#78350F" style={styles.icon} />
              </Animated.View>
              <Text style={styles.bannerText} numberOfLines={2}>
                Device Offline — Using Pre-Admission Tension Queue
              </Text>
            </View>
            <TouchableOpacity
              testID="reconnect-button"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.reconnectButton}
              onPress={handleReconnect}
              activeOpacity={0.7}
            >
              <Text style={styles.reconnectButtonText}>Reconnect</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'reconnecting' && (
          <>
            <View style={styles.textAndIconContainer}>
              <Animated.View style={rotateStyle}>
                <Ionicons name="sync-outline" size={16} color="#0369A1" style={styles.icon} />
              </Animated.View>
              <Text style={[styles.bannerText, styles.bannerTextReconnecting]} numberOfLines={2}>
                Reconnecting to Truex Membrane...
              </Text>
            </View>
            <View
              style={[styles.reconnectButton, styles.buttonDisabled]}
              testID="reconnecting-indicator"
            >
              <Text style={styles.reconnectButtonTextDisabled}>Connecting</Text>
            </View>
          </>
        )}

        {status === 'connected' && (
          <View style={[styles.textAndIconContainer, { justifyContent: 'center', flex: 1 }]}>
            <Animated.View style={successScaleStyle}>
              <Ionicons name="checkmark-circle" size={16} color="#065F46" style={styles.icon} />
            </Animated.View>
            <Text style={[styles.bannerText, styles.bannerTextConnected]} numberOfLines={1}>
              Connection Restored
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FEF3C7', // amber-100
    borderBottomColor: '#FDE68A', // amber-200
    width: '100%',
    overflow: 'hidden',
  },
  bannerContainerReconnecting: {
    backgroundColor: '#E0F2FE', // sky-100
    borderBottomColor: '#BAE6FD', // sky-200
  },
  bannerContainerConnected: {
    backgroundColor: '#D1FAE5', // emerald-100
    borderBottomColor: '#A7F3D0', // emerald-200
  },
  innerContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  textAndIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  bannerText: {
    color: '#78350F', // amber-900
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
  },
  bannerTextReconnecting: {
    color: '#0369A1', // sky-700
  },
  bannerTextConnected: {
    color: '#065F46', // emerald-800
    textAlign: 'center',
    flex: 0,
  },
  reconnectButton: {
    backgroundColor: '#78350F', // amber-900
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 8,
  },
  buttonDisabled: {
    backgroundColor: '#BAE6FD', // sky-200
  },
  reconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reconnectButtonTextDisabled: {
    color: '#0284C7', // sky-600
    fontSize: 11,
    fontWeight: '700',
  },
});

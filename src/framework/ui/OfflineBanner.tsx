import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import { Ionicons } from '@expo/vector-icons';

export function OfflineBanner() {
  const networkOnline = useActorOpsStore((state) => state.networkOnline);
  const setNetworkOnline = useActorOpsStore((state) => state.setNetworkOnline);

  const [status, setStatus] = React.useState<'idle' | 'offline' | 'reconnecting' | 'connected'>(
    networkOnline ? 'idle' : 'offline'
  );

  const heightAnim = React.useRef(new Animated.Value(networkOnline ? 0 : 1)).current;
  const opacityAnim = React.useRef(new Animated.Value(networkOnline ? 0 : 1)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const successScaleAnim = React.useRef(new Animated.Value(0.3)).current;

  const prevNetworkOnline = React.useRef(networkOnline);

  React.useEffect(() => {
    if (networkOnline && !prevNetworkOnline.current) {
      // Transition from offline/reconnecting to online
      setStatus('connected');

      // Animate success scale
      successScaleAnim.setValue(0.3);
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }).start();

      // Hold success state for 1500ms, then animate closed
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(heightAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setStatus('idle');
        });
      }, 1500);

      return () => clearTimeout(timer);
    } else if (!networkOnline && prevNetworkOnline.current) {
      // Transition from online to offline
      setStatus('offline');
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    }

    prevNetworkOnline.current = networkOnline;
  }, [networkOnline]);

  // Handle pulse animation for offline icon
  React.useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (status === 'offline') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [status]);

  // Handle rotation animation for reconnecting icon
  React.useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (status === 'reconnecting') {
      rotateAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      rotateAnim.setValue(0);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
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

  if (status === 'idle') {
    return null;
  }

  const containerHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });

  const containerTranslateY = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const containerBorderWidth = heightAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0, 1],
  });

  const iconRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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
        {
          height: containerHeight,
          opacity: opacityAnim,
          borderBottomWidth: containerBorderWidth,
          transform: [{ translateY: containerTranslateY }],
        },
        status === 'reconnecting' && styles.bannerContainerReconnecting,
        status === 'connected' && styles.bannerContainerConnected,
      ]}>
      <View style={styles.innerContainer}>
        {status === 'offline' && (
          <>
            <View style={styles.textAndIconContainer}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }], opacity: pulseAnim }}>
                <Ionicons name="cloud-offline" size={16} color="#78350F" style={styles.icon} />
              </Animated.View>
              <Text style={styles.bannerText} numberOfLines={2}>
                Device Offline — Using Pre-Admission Tension Queue
              </Text>
            </View>
            <TouchableOpacity
              testID="reconnect-button"
              style={styles.reconnectButton}
              onPress={handleReconnect}
              activeOpacity={0.7}>
              <Text style={styles.reconnectButtonText}>Reconnect</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'reconnecting' && (
          <>
            <View style={styles.textAndIconContainer}>
              <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
                <Ionicons name="sync-outline" size={16} color="#0369A1" style={styles.icon} />
              </Animated.View>
              <Text style={[styles.bannerText, styles.bannerTextReconnecting]} numberOfLines={2}>
                Reconnecting to Truex Membrane...
              </Text>
            </View>
            <View
              style={[styles.reconnectButton, styles.buttonDisabled]}
              testID="reconnecting-indicator">
              <Text style={styles.reconnectButtonTextDisabled}>Connecting</Text>
            </View>
          </>
        )}

        {status === 'connected' && (
          <View style={[styles.textAndIconContainer, { justifyContent: 'center', flex: 1 }]}>
            <Animated.View style={{ transform: [{ scale: successScaleAnim }] }}>
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

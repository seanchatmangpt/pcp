import 'react-native-get-random-values';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from '@/src/components/AvatarRelativeProjection';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useColorScheme } from '@/src/components/useColorScheme';
import { SessionProvider, useSession } from '../../context/SessionProvider';
import { TransitionOverlay } from '@/src/components/TransitionOverlay';
import Colors from '@/src/constants/Colors';
import { PcpFrameworkProvider } from '@pcp/framework/core/PcpFrameworkProvider';
import { AutonomicSimulationManager } from '@/src/components/AutonomicSimulationManager';
import { AdaptiveInteractionWrapper } from '@/src/framework/auto/ux/adaptive/AdaptiveInteractionWrapper';

// Import your global CSS file
import '../../global.css';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash Avatar-Relative Projection from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AvatarRelativeProjectionSplashController() {
  const { loading: sessionLoading } = useSession();
  const [loaded, error] = useFonts({
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    // Only hide splash Avatar-Relative Projection when BOTH fonts AND session are loaded
    if (loaded && !sessionLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, sessionLoading]);

  // Show loading Avatar-Relative Projection until everything is ready
  if (!loaded || sessionLoading) {
    return null;
  }

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <AutonomicSimulationManager />
        <AvatarRelativeProjectionSplashController />
        <RootLayoutNav />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: '#f43f5e',
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: '#f43f5e',
  },
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isTransitioning, transitionType } = useSession();

  return (
    <PcpFrameworkProvider>
      <AdaptiveInteractionWrapper>
        <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                animation: 'fade',
                animationDuration: 300,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            <TransitionOverlay
              isTransitioning={isTransitioning}
              transitionType={transitionType}
              colorScheme={colorScheme as any}
            />
          </View>
        </ThemeProvider>
      </AdaptiveInteractionWrapper>
    </PcpFrameworkProvider>
  );
}

import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from '@/src/components/AvatarRelativeProjection';

import Colors from '@/src/constants/Colors';
import { useColorScheme } from '@/src/components/useColorScheme';
import { useClientOnlyValue } from '@/src/components/useClientOnlyValue';
import { ProtectedRoute } from '@/src/route-law/ProtectedRoute';

// Custom TabBarIcon component with perfect alignment
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string | import('react-native').ColorValue;
}) {
  return <FontAwesome size={24} style={{ marginBottom: 0 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ProtectedRoute route={{ requiredIdentityBoundary: 'authenticated' }}>
      <Tabs
      avatarRelativeProjectionOptions={{
        tabBarActiveTintColor: themeColors.tint,
        tabBarInactiveTintColor: themeColors.tabIconDefault,
        // Floating premium tab bar styling
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 20,
          right: 20,
          height: 68,
          borderRadius: 24,
          backgroundColor: themeColors.card,
          borderTopWidth: 0,
          paddingTop: 10,
          paddingBottom: 10,
          // Shadow styling for iOS
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
          shadowRadius: 12,
          // Elevation for Android
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerStyle: {
          backgroundColor: themeColors.card,
          borderBottomColor: themeColors.border,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
          color: themeColors.text,
        },
        headerTintColor: themeColors.tint,
        // Disable the static render of the header on web
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Consequence Supervision',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="hooks"
        options={{
          title: 'Truex Hook Cockpit',
          tabBarLabel: 'Hooks',
          tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="link" color={color} />,
        }}
      />
      <Tabs.Screen
        name="openai"
        options={{
          href: null, // Quarantined from main tab navigation
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          href: null, // Quarantined from main tab navigation
        }}
      />
      <Tabs.Screen
        name="process"
        options={{
          href: null, // Quarantined from main tab navigation
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account Settings',
          tabBarLabel: 'Account',
          tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Truex Mission Control',
          tabBarLabel: 'Admin',
          tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="gears" color={color} />,
          tabBarButtonTestID: 'dev-actor-lab-tab',
        }}
      />
    </Tabs>
    </ProtectedRoute>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

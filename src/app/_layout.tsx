import React from 'react';
import { Stack } from 'expo-router';
import { ProtectedRoute } from '@/src/route-law/ProtectedRoute';

export default function AdminLayout() {
  return (
    <ProtectedRoute route={{ requiredIdentityBoundary: 'verified' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="consequence-supervision" />
        <Stack.Screen name="actor-lab" />
        <Stack.Screen name="receipts" />
        <Stack.Screen name="outbox" />
        <Stack.Screen name="realtime" />
        <Stack.Screen name="sermons" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="church" />
        <Stack.Screen name="content" />
        <Stack.Screen name="events" />
        <Stack.Screen name="groups" />
        <Stack.Screen name="people" />
        <Stack.Screen name="prayer" />
        <Stack.Screen name="volunteers" />
        <Stack.Screen name="intelligence" />
      </Stack>
    </ProtectedRoute>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

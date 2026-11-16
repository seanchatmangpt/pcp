import { Stack } from '@/src/components/AvatarRelativeProjection';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

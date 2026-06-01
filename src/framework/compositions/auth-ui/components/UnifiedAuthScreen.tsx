import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../../auth/AuthProvider';
import { useBiometricAuth } from '../../../auth/biometric/useBiometricAuth';
import { useMfaVerification } from '../../../auth/mfa/useMfaVerification';
import { Button } from '../../../ui/Button';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export const UnifiedAuthScreen: React.FC = () => {
  const { session, setSession } = useAuth();
  const signOut = () => setSession(null);
  const user = session as any;
  const { authenticate: bioAuth, isAuthenticating: isBioLoading } = useBiometricAuth();
  const { verify, activeChallenge } = useMfaVerification();
  const isMfaLoading = activeChallenge !== null;

  if (user) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
        <Text style={styles.text}>Welcome back, {user.email}</Text>
        <Button onPress={signOut} variant="secondary">
          Sign Out
        </Button>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
      <Text style={styles.title}>Secure Login</Text>
      <Button onPress={() => bioAuth()} isLoading={isBioLoading} style={styles.button}>
        Biometric Login
      </Button>
      <Button
        onPress={() => verify()}
        isLoading={isMfaLoading}
        variant="secondary"
        style={styles.button}>
        Enter MFA Code
      </Button>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  text: { fontSize: 16, marginBottom: 20 },
  button: { width: '100%', marginBottom: 12 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface PermissionGateProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  testID?: string;
}

export function PermissionGate({ allowedRoles, children, fallback, testID }: PermissionGateProps) {
  const { currentPrincipal } = useActorOpsStore();

  const isAllowed = allowedRoles.includes(currentPrincipal.role);

  if (!isAllowed) {
    if (fallback !== undefined) {
      return <View testID={testID}>{fallback}</View>;
    }
    return (
      <View
        style={styles.container}
        testID={testID}
        accessible={true}
        accessibilityLabel={`Access Restricted. Requires one of: ${allowedRoles.join(', ')}. Current role: ${currentPrincipal.role}`}
      >
        <FontAwesome name="lock" size={24} color="#F87171" style={styles.icon} />
        <Text style={styles.errorTitle}>Access Restricted</Text>
        <Text style={styles.errorText}>
          Requires one of: [{allowedRoles.join(', ')}]{'\n'}
          Current role: {currentPrincipal.role}
        </Text>
      </View>
    );
  }

  return <View testID={testID}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#451A1A', // red-900 / darker
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7F1D1D', // red-800
    padding: 16,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 8,
  },
  errorTitle: {
    color: '#FCA5A5', // red-300
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    color: '#FECACA', // red-200
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

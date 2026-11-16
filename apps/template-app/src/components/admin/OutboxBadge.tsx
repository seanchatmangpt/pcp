import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OutboxBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  testID?: string;
}

export function OutboxBadge({ status, testID }: OutboxBadgeProps) {
  let backgroundColor = '#334155'; // slate-700
  let textColor = '#94A3B8'; // slate-400

  switch (status) {
    case 'pending':
      backgroundColor = 'rgba(245, 158, 11, 0.2)'; // amber-500/20
      textColor = '#FCD34D'; // amber-300
      break;
    case 'processing':
      backgroundColor = 'rgba(59, 130, 246, 0.2)'; // blue-500/20
      textColor = '#93C5FD'; // blue-300
      break;
    case 'completed':
      backgroundColor = 'rgba(16, 185, 129, 0.2)'; // emerald-500/20
      textColor = '#6EE7B7'; // emerald-300
      break;
    case 'failed':
      backgroundColor = 'rgba(239, 68, 68, 0.2)'; // red-500/20
      textColor = '#FCA5A5'; // red-300
      break;
  }

  return (
    <View
      style={[styles.badge, { backgroundColor }]}
      testID={testID}
      accessible={true}
      accessibilityLabel={`Outbox status: ${status}`}
    >
      <Text style={[styles.text, { color: textColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

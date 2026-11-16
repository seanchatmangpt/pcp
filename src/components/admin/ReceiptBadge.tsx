import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReceiptStatus } from '../../lib/actor/types';

interface ReceiptBadgeProps {
  status: ReceiptStatus;
  testID?: string;
}

export function ReceiptBadge({ status, testID }: ReceiptBadgeProps) {
  let backgroundColor = '#334155'; // Slate 700
  let textColor = '#94A3B8'; // Slate 400
  const safeStatus = status || 'accepted_pending';

  switch (safeStatus) {
    case 'accepted_pending':
      backgroundColor = 'rgba(217, 119, 6, 0.2)'; // amber-600/20
      textColor = '#FBBF24'; // amber-300
      break;
    case 'rejected_local':
      backgroundColor = 'rgba(239, 68, 68, 0.2)'; // red-500/20
      textColor = '#FCA5A5'; // red-300
      break;
    case 'applied_local':
      backgroundColor = 'rgba(16, 185, 129, 0.2)'; // emerald-500/20
      textColor = '#6EE7B7'; // emerald-300
      break;
    case 'applied_remote':
      backgroundColor = 'rgba(59, 130, 246, 0.2)'; // blue-500/20
      textColor = '#93C5FD'; // blue-300
      break;
    case 'rejected_remote':
      backgroundColor = 'rgba(153, 27, 27, 0.4)'; // red-800/40
      textColor = '#F87171'; // red-400
      break;
    case 'quarantined':
      backgroundColor = 'rgba(139, 92, 246, 0.2)'; // violet-500/20
      textColor = '#C4B5FD'; // violet-300
      break;
  }

  return (
    <View
      style={[styles.badge, { backgroundColor }]}
      testID={testID}
      accessible={true}
      accessibilityLabel={`Receipt status: ${safeStatus.replace('_', ' ')}`}
    >
      <Text style={[styles.text, { color: textColor }]}>{safeStatus.replace('_', ' ')}</Text>
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

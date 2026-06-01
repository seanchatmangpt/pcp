import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple';
  testID?: string;
}

export function StatusBadge({ status, variant, testID }: StatusBadgeProps) {
  let backgroundColor = '#334155'; // neutral base
  let textColor = '#94A3B8';

  const safeStatus = status || 'unknown';

  let derivedVariant = variant;
  if (!derivedVariant) {
    const s = safeStatus.toLowerCase();
    if (s.includes('reject') || s.includes('fail') || s.includes('error'))
      derivedVariant = 'danger';
    else if (s.includes('accept') || s.includes('pending')) derivedVariant = 'warning';
    else if (s.includes('applied') || s.includes('success') || s.includes('ok'))
      derivedVariant = 'success';
    else if (s.includes('quarantine')) derivedVariant = 'purple';
    else if (s.includes('remote')) derivedVariant = 'info';
    else derivedVariant = 'neutral';
  }

  switch (derivedVariant) {
    case 'warning':
      backgroundColor = 'rgba(217, 119, 6, 0.2)'; // amber-600/20
      textColor = '#FBBF24'; // amber-300
      break;
    case 'danger':
      backgroundColor = 'rgba(239, 68, 68, 0.2)'; // red-500/20
      textColor = '#FCA5A5'; // red-300
      break;
    case 'success':
      backgroundColor = 'rgba(16, 185, 129, 0.2)'; // emerald-500/20
      textColor = '#6EE7B7'; // emerald-300
      break;
    case 'info':
      backgroundColor = 'rgba(59, 130, 246, 0.2)'; // blue-500/20
      textColor = '#93C5FD'; // blue-300
      break;
    case 'purple':
      backgroundColor = 'rgba(139, 92, 246, 0.2)'; // violet-500/20
      textColor = '#C4B5FD'; // violet-300
      break;
    case 'neutral':
    default:
      backgroundColor = '#334155';
      textColor = '#94A3B8';
      break;
  }

  return (
    <View
      style={[styles.badge, { backgroundColor }]}
      testID={testID}
      accessible={true}
      accessibilityLabel={`Status: ${safeStatus.replace('_', ' ')}`}>
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

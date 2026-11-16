import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ActorRef } from '../../lib/actor/types';
import { useTheme } from '../../framework/ui/theme/useTheme';

interface ActorRefViewProps {
  actorRef: ActorRef | string;
  testID?: string;
}

export function ActorRefView({ actorRef, testID }: ActorRefViewProps) {
  const theme = useTheme();
  let parsed: ActorRef | null = null;
  let hasError = false;

  try {
    parsed = typeof actorRef === 'string' ? JSON.parse(actorRef) : actorRef;
    if (!parsed || typeof parsed !== 'object' || !parsed.kind || !parsed.id) {
      hasError = true;
    }
  } catch (e) {
    hasError = true;
  }

  if (hasError || !parsed) {
    return (
      <View
        style={[
          styles.container,
          styles.errorContainer,
        ]}
        testID={testID}
        accessible={true}
        accessibilityLabel="Invalid Actor reference"
        accessibilityRole="text"
      >
        <Text style={styles.errorText}>Invalid ActorRef</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
      testID={testID}
      accessible={true}
      accessibilityLabel={`Actor reference: Kind ${parsed.kind}, ID ${parsed.id}`}
    >
      <View style={styles.kindBadge}>
        <Text style={styles.badgeText}>{parsed.kind}</Text>
      </View>
      <Text style={styles.idText} numberOfLines={1} ellipsizeMode="tail">
        {parsed.id}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B', // slate-800
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  kindBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500/20
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA', // blue-400
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  idText: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
    color: '#E2E8F0', // slate-200
    flexShrink: 1,
  },
  errorText: {
    color: '#F87171', // red-400
    fontSize: 12,
    fontWeight: '500',
  },
});

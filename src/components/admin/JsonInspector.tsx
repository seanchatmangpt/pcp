import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface JsonInspectorProps {
  data: any;
  title?: string;
  testID?: string;
}

export function JsonInspector({ data, title, testID }: JsonInspectorProps) {
  const [collapsed, setCollapsed] = useState(true);

  let formatted = '';
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;
    formatted = JSON.stringify(obj, null, 2);
  } catch (e) {
    formatted = String(data);
  }

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
        testID={`${testID}-toggle`}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={title || 'View Payload'}
        accessibilityState={{ expanded: !collapsed }}
      >
        <Text style={styles.title}>{title || 'View Payload'}</Text>
        <View style={styles.iconContainer}>
          <Text style={styles.arrow}>{collapsed ? '▶' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {!collapsed && (
        <View style={styles.body} testID={`${testID}-body`}>
          <Text style={styles.jsonText} selectable>
            {formatted}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A', // slate-900 (code background)
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
    marginTop: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E293B', // slate-800
  },
  title: {
    fontSize: 12,
    color: '#E2E8F0', // slate-200
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 20,
    alignItems: 'flex-end',
  },
  arrow: {
    fontSize: 10,
    color: '#94A3B8', // slate-400
  },
  body: {
    padding: 12,
    maxHeight: 300, // Slightly taller
  },
  jsonText: {
    fontFamily: 'SpaceMono',
    fontSize: 11, // Better readability
    lineHeight: 16,
    color: '#34D399', // emerald-400 for code
  },
});

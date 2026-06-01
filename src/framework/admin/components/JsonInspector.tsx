import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface JsonInspectorProps {
  data: any;
  title?: string;
  testID?: string;
  initiallyExpanded?: boolean;
}

export function JsonInspector({
  data,
  title,
  testID,
  initiallyExpanded = false,
}: JsonInspectorProps) {
  const [collapsed, setCollapsed] = useState(!initiallyExpanded);

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
        testID={testID ? `${testID}-toggle` : 'json-inspector-toggle'}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={title || 'View Payload'}
        accessibilityState={{ expanded: !collapsed }}>
        <Text style={styles.title}>{title || 'View Payload'}</Text>
        <View style={styles.iconContainer}>
          <Text style={styles.arrow}>{collapsed ? '▶' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {!collapsed && (
        <View style={styles.body} testID={testID ? `${testID}-body` : 'json-inspector-body'}>
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
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
  },
  title: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 20,
    alignItems: 'flex-end',
  },
  arrow: {
    fontSize: 10,
    color: '#94A3B8',
  },
  body: {
    padding: 12,
    maxHeight: 300,
  },
  jsonText: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    lineHeight: 16,
    color: '#34D399',
  },
});

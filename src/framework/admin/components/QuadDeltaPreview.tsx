import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface QuadDeltaPreviewProps {
  delta:
    | {
        add?: any[];
        remove?: any[];
      }
    | string
    | null
    | undefined;
  testID?: string;
}

export function QuadDeltaPreview({ delta, testID }: QuadDeltaPreviewProps) {
  let parsed: { add?: any[]; remove?: any[] } = {};

  try {
    if (!delta) {
      throw new Error('Empty delta');
    }
    parsed = typeof delta === 'string' ? JSON.parse(delta) : delta;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Not an object');
    }
  } catch (e) {
    return (
      <View style={[styles.container, styles.errorContainer]} testID={testID}>
        <Text style={styles.errorText}>Invalid Delta payload</Text>
      </View>
    );
  }

  const additions = Array.isArray(parsed.add) ? parsed.add : [];
  const removals = Array.isArray(parsed.remove) ? parsed.remove : [];

  if (additions.length === 0 && removals.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]} testID={testID}>
        <Text style={styles.emptyText}>No changes (empty delta)</Text>
      </View>
    );
  }

  const renderQuad = (q: any, type: 'add' | 'remove', index: number) => {
    const color = type === 'add' ? '#34D399' : '#F87171';
    const prefix = type === 'add' ? '+' : '-';

    const formatNode = (node: any) => {
      if (!node) return 'null';
      const val = typeof node === 'string' ? node : node.value || String(node);
      return val
        .replace('https://schema.org/', 'schema:')
        .replace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:');
    };

    return (
      <View key={`${type}-${index}`} style={styles.quadLine}>
        <Text style={[styles.prefix, { color }]}>{prefix}</Text>
        <Text style={styles.codeText} selectable>
          <Text style={styles.subject}>{formatNode(q?.subject)}</Text>{' '}
          <Text style={styles.predicate}>{formatNode(q?.predicate)}</Text>{' '}
          <Text style={styles.object}>{formatNode(q?.object)}</Text>
        </Text>
      </View>
    );
  };

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible={true}
      accessibilityLabel={`Quad Delta Preview: ${removals.length} removals, ${additions.length} additions`}>
      {removals.map((q, i) => renderQuad(q, 'remove', i))}
      {additions.map((q, i) => renderQuad(q, 'add', i))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  quadLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  prefix: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    marginRight: 8,
    fontWeight: '700',
    marginTop: 2,
  },
  codeText: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    lineHeight: 18,
    flex: 1,
  },
  subject: {
    color: '#60A5FA',
  },
  predicate: {
    color: '#F472B6',
  },
  object: {
    color: '#10B981',
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

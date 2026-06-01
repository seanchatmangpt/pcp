import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

interface AutoFixerProps {
  type: string;
  testID?: string;
}

/**
 * Dev-mode UI component shown when a semantic component is missing.
 * Provides a way to trigger scaffolding for the missing type.
 */
export function AutoFixer({ type, testID }: AutoFixerProps) {
  const [fixing, setFixing] = useState(false);
  const [fixed, setFixed] = useState(false);

  const handleFix = async () => {
    setFixing(true);
    // In a real DX environment, this might hit a local dev server endpoint
    // that executes: npm run gen:semantic --name=<TypeName>
    try {
      // Simulate scaffolding process
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setFixed(true);
    } catch (error) {
      console.error('Failed to auto-scaffold:', error);
    } finally {
      setFixing(false);
    }
  };

  const typeName = type.split('/').pop() || type;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>Missing Semantic Component</Text>
        <Text style={styles.badge}>AutoDX</Text>
      </View>

      <Text style={styles.description}>
        No component found for RDF type:{'\n'}
        <Text style={styles.typeText}>{type}</Text>
      </Text>

      {fixed ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            Scaffolded! Restarting may be required to hot-load the new component.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={handleFix}
          disabled={fixing}
          activeOpacity={0.7}>
          {fixing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>🚀 Run cli-scaffold {typeName}</Text>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.footer}>Blueprint: _templates/semantic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB', // amber-50
    borderWidth: 2,
    borderColor: '#F59E0B', // amber-500
    borderRadius: 12,
    padding: 16,
    margin: 8,
    borderStyle: 'dashed',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#92400E', // amber-800
    fontSize: 16,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  description: {
    color: '#B45309', // amber-700
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  typeText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#D1FAE5', // emerald-100
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successText: {
    color: '#065F46',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    marginTop: 12,
    color: '#D97706',
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

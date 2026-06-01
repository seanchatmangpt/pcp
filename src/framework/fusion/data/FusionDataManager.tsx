import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView } from 'react-native';
import { FusionDataManagerProps, FusionDataState, FusionQuery } from './types';
import { useNeuroSymbolicQuery } from '../../data/neuro-symbolic/useNeuroSymbolicQuery';
import { usePredictivePrefetch } from '../../data/predictive/usePredictivePrefetch';
import { SemanticListView } from '../../compositions/semantic-crud/SemanticListView';
import { SemanticForm } from '../../data/forms/SemanticForm';
import { useVkg } from '../../vkg/react';
import { VKGClientFacade } from '../../vkg/client';

const vkgClient = new VKGClientFacade();

/**
 * FusionDataManager
 *
 * A high-level orchestrator that fuses:
 * 1. Neuro-Symbolic Querying (intelligent, fuzzy + exact search)
 * 2. Predictive Prefetching (pre-emptive data loading)
 * 3. Semantic CRUD (standardized data management)
 * 4. Generative UI Hints (local inference for dynamic rendering)
 */
export const FusionDataManager: React.FC<FusionDataManagerProps> = ({
  targetType,
  initialQuery,
  onEntitySelect,
  onEntityCreate,
  onEntityUpdate,
  onEntityDelete,
  uiHint,
}) => {
  const [mode, setMode] = useState<FusionDataState['mode']>('list');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery?.neuro?.prompt || '');

  const { triggerHook } = useVkg();

  // Construct the active neuro-symbolic query
  const currentQuery: FusionQuery = useMemo(
    () => ({
      symbolic: {
        predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: targetType,
      },
      neuro: {
        prompt: searchQuery,
        threshold: 0.7,
        limit: 20,
      },
      prefetchEnabled: true,
    }),
    [targetType, searchQuery]
  );

  // 1. Neuro-Symbolic Querying
  const {
    data: results,
    loading,
    error,
    refetch,
  } = useNeuroSymbolicQuery(vkgClient as any, currentQuery);

  // 2. Predictive Prefetching
  // We prefetch based on the targetType to warm up the cache for related entities
  usePredictivePrefetch(targetType, { depth: 2 });

  const handleSelect = (entityId: string) => {
    setSelectedEntityId(entityId);
    setMode('details');
    onEntitySelect?.(entityId);
  };

  const handleCreate = () => {
    setSelectedEntityId(null);
    setMode('create');
  };

  const handleEdit = () => {
    setMode('edit');
  };

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      const entityId =
        mode === 'create' ? `https://pcp.app/entity/${Date.now()}` : selectedEntityId;

      if (!entityId) return;

      // Persistence orchestration
      for (const [predicate, value] of Object.entries(data)) {
        await triggerHook(entityId, predicate, String(value));
      }

      if (mode === 'create') {
        await triggerHook(entityId, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', targetType);
        onEntityCreate?.(data);
      } else {
        onEntityUpdate?.(entityId, data);
      }

      setMode('list');
      setSelectedEntityId(null);
      refetch();
    } catch (err) {
      Alert.alert('Fusion Error', 'Failed to persist data to the neuro-symbolic layer.');
    }
  };

  const handleCancel = () => {
    setMode('list');
    setSelectedEntityId(null);
  };

  const handleDelete = async () => {
    if (selectedEntityId) {
      // In a real implementation, we would also delete from VKG
      onEntityDelete?.(selectedEntityId);
      setMode('list');
      setSelectedEntityId(null);
      refetch();
    }
  };

  return (
    <View style={styles.container}>
      {uiHint && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>AI Insight: {uiHint}</Text>
        </View>
      )}

      {mode === 'list' && (
        <SemanticListView targetType={targetType} onSelect={handleSelect} onCreate={handleCreate} />
      )}

      {(mode === 'create' || mode === 'edit') && (
        <SemanticForm
          targetType={targetType}
          client={vkgClient}
          initialData={{}}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={mode === 'create' ? 'Create' : 'Save'}
        />
      )}

      {mode === 'details' && selectedEntityId && (
        <ScrollView style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Fusion Entity</Text>
          <Text style={styles.detailsId}>{selectedEntityId}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={handleEdit}>
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}>
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
            <Text style={styles.backButtonText}>Back to Discovery</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  hintBanner: {
    backgroundColor: '#F0F7FF',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#CCE5FF',
  },
  hintText: {
    color: '#004085',
    fontSize: 12,
    fontStyle: 'italic',
  },
  detailsContainer: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailsId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  errorBanner: {
    backgroundColor: '#FFF0F0',
    padding: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    fontSize: 12,
  },
});

import React, { useState } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SemanticCrudManagerProps, SemanticCrudState } from './types';
import { SemanticListView } from './SemanticListView';
import { SemanticForm } from '../../data/forms/SemanticForm';
import { useVkg } from '../../vkg/react';
import { VKGClientFacade } from '../../vkg/client';

const vkgClient = new VKGClientFacade();

/**
 * SemanticCrudManager
 *
 * The main orchestrator for Semantic CRUD operations.
 * - Manages view modes (list, create, edit, details).
 * - Orchestrates useSemanticForm for data entry.
 * - Orchestrates useOfflineSearch via SemanticListView.
 * - Orchestrates useVkg for persisting changes via triggerHook.
 */
export const SemanticCrudManager: React.FC<SemanticCrudManagerProps> = ({
  targetType,
  onEntitySelect,
  onEntityCreate,
  onEntityUpdate,
  onEntityDelete,
}) => {
  const [state, setState] = useState<SemanticCrudState>({
    mode: 'list',
    selectedEntityId: null,
    searchQuery: '',
  });

  const { triggerHook } = useVkg();

  const handleSelect = (entityId: string) => {
    setState((prev) => ({ ...prev, selectedEntityId: entityId, mode: 'details' }));
    onEntitySelect?.(entityId);
  };

  const handleCreate = () => {
    setState((prev) => ({ ...prev, mode: 'create', selectedEntityId: null }));
  };

  const handleEdit = () => {
    setState((prev) => ({ ...prev, mode: 'edit' }));
  };

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      const entityId =
        state.mode === 'create' ? `https://pcp.app/entity/${Date.now()}` : state.selectedEntityId;

      if (!entityId) return;

      // Persistence orchestration via useVkg.triggerHook
      // Each field in the form is pushed as a semantic delta.
      for (const [predicate, value] of Object.entries(data)) {
        await triggerHook(entityId, predicate, String(value));
      }

      // Ensure the type is set for new entities
      if (state.mode === 'create') {
        await triggerHook(entityId, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', targetType);
        onEntityCreate?.(data);
      } else {
        onEntityUpdate?.(entityId, data);
      }

      setState((prev) => ({ ...prev, mode: 'list', selectedEntityId: null }));
    } catch (error) {
      Alert.alert('Persistence Error', 'Failed to save semantic data to the graph.');
    }
  };

  const handleCancel = () => {
    setState((prev) => ({ ...prev, mode: 'list', selectedEntityId: null }));
  };

  const handleDelete = async () => {
    if (state.selectedEntityId) {
      onEntityDelete?.(state.selectedEntityId);
      setState((prev) => ({ ...prev, mode: 'list', selectedEntityId: null }));
    }
  };

  return (
    <View style={styles.container}>
      {state.mode === 'list' && (
        <SemanticListView targetType={targetType} onSelect={handleSelect} onCreate={handleCreate} />
      )}

      {(state.mode === 'create' || state.mode === 'edit') && (
        <SemanticForm
          targetType={targetType}
          client={vkgClient}
          initialData={{}} // In a real app, we'd pre-populate for 'edit'
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={state.mode === 'create' ? 'Create' : 'Save Changes'}
        />
      )}

      {state.mode === 'details' && state.selectedEntityId && (
        <ScrollView style={styles.detailsContainer} testID="details-view">
          <Text style={styles.detailsTitle}>Entity Details</Text>
          <Text style={styles.detailsId} testID="details-entity-id">
            {state.selectedEntityId}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={handleEdit}
              testID="edit-button">
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              testID="delete-button">
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={handleCancel} testID="back-button">
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
});

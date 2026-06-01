import React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useOfflineSearch } from '../../data/offline-search';
import { SearchResult } from '../../data/offline-search/types';

export interface SemanticListViewProps {
  targetType: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

/**
 * SemanticListView
 *
 * Provides a high-performance, search-first interface for browsing semantic entities.
 * Orchestrates useOfflineSearch for sub-millisecond local filtering.
 */
export const SemanticListView: React.FC<SemanticListViewProps> = ({
  targetType,
  onSelect,
  onCreate,
}) => {
  const { results, loading, search, query } = useOfflineSearch();

  // Extract a readable label for the type
  const typeLabel = targetType.split(/[/#]/).pop() || targetType;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${typeLabel}s...`}
          value={query}
          onChangeText={search}
          testID="search-input"
        />
        <TouchableOpacity style={styles.createButton} onPress={onCreate} testID="create-button">
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item, index) => `${item.subject}-${index}`}
        renderItem={({ item }: { item: SearchResult }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => onSelect(item.subject)}
            testID={`item-${item.subject}`}>
            <View>
              <Text style={styles.itemSubject}>
                {item.subject.split(/[/#]/).pop() || item.subject}
              </Text>
              <Text style={styles.itemPredicate}>
                {item.predicate.split(/[/#]/).pop() || item.predicate}
              </Text>
              <Text style={styles.itemValue} numberOfLines={2}>
                {item.objectValue}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText} testID="empty-text">
                {query ? 'No matching entities found.' : `Search to find ${typeLabel}s.`}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  createButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  centered: {
    padding: 20,
    alignItems: 'center',
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemSubject: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  itemPredicate: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  itemValue: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
    fontSize: 14,
  },
});

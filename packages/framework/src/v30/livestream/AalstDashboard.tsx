import React from 'react';
import { View, Text, FlatList, StyleSheet, ListRenderItemInfo } from 'react-native';
import { useAalstStream, AalstEvent } from './useAalstStream';

const PetriNetViz: React.FC<{ payload: string }> = ({ payload }) => {
  let data;
  try {
    data = JSON.parse(payload);
  } catch (e) {
    return (
      <View style={styles.petriContainer} testID="petri-net-viz">
        <Text style={styles.vizTitle}>Real-time Petri Net Visualization</Text>
        <Text>Invalid Petri Net Data</Text>
      </View>
    );
  }
  return (
    <View style={styles.petriContainer} testID="petri-net-viz">
      <Text style={styles.vizTitle}>Real-time Petri Net Visualization</Text>
      <View style={styles.nodesContainer}>
        {data.places?.map((p: any) => (
          <View key={p.id} style={styles.place}>
            <Text style={styles.placeText}>{p.id}</Text>
            {p.tokens > 0 && <View style={styles.token} />}
          </View>
        ))}
        {data.transitions?.map((t: any) => (
          <View key={t.id} style={[styles.transition, t.enabled && styles.transitionEnabled]}>
            <Text style={styles.transitionText}>{t.id}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const AalstDashboard: React.FC = () => {
  const { isConnected, logs } = useAalstStream();

  const renderItem = ({ item }: ListRenderItemInfo<AalstEvent>) => {
    if (item.type === 'PETRI_NET') {
      return (
        <View style={styles.logItem} testID={`log-item-${item.id}`}>
          <PetriNetViz payload={item.payload} />
        </View>
      );
    }

    if (item.type === 'CONVERSATION_FEED') {
      return (
        <View style={[styles.logItem, styles.conversationItem]} testID={`log-item-${item.id}`}>
          <Text style={styles.conversationLabel}>Swarm Message:</Text>
          <Text style={styles.conversationText}>{item.payload}</Text>
          <Text style={styles.logType}>{item.type}</Text>
        </View>
      );
    }

    return (
      <View style={styles.logItem} testID={`log-item-${item.id}`}>
        <Text style={styles.logType}>{item.type}</Text>
        <Text style={styles.logPayload}>{item.payload}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text testID="connection-status" style={styles.status}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        <Text testID="broadcast-badge" style={styles.broadcastBadge}>
          BROADCAST ACTIVE - VAN DER AALST CERTIFIED
        </Text>
      </View>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        testID="logs-list"
        ListEmptyComponent={<Text testID="empty-text">No logs yet</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  status: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  broadcastBadge: {
    backgroundColor: '#2ecc71',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  logItem: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    marginTop: 4,
  },
  logPayload: {
    fontSize: 14,
    color: '#444',
  },
  petriContainer: {
    padding: 8,
  },
  vizTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  nodesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  place: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  placeText: {
    fontSize: 10,
    color: '#3498db',
  },
  token: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2c3e50',
    position: 'absolute',
  },
  transition: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: '#95a5a6',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  transitionEnabled: {
    borderColor: '#2ecc71',
    backgroundColor: '#eafaf1',
  },
  transitionText: {
    fontSize: 10,
    color: '#7f8c8d',
  },
  conversationItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#9b59b6',
  },
  conversationLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8e44ad',
  },
  conversationText: {
    fontSize: 16,
    color: '#2c3e50',
    marginTop: 4,
  },
});

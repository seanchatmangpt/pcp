import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { ReceiptBadge } from '../../components/admin/ReceiptBadge';
import { ActorRefView } from '../../components/admin/ActorRefView';
import { JsonInspector } from '../../components/admin/JsonInspector';
import { db } from '../../lib/db/db';
import { actorReceipts } from '../../lib/db/schema';
import { desc } from 'drizzle-orm';

export default function AdminReceipts() {
  const [receiptsList, setReceiptsList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReceipts = async () => {
    setRefreshing(true);
    try {
      const list = await db.select().from(actorReceipts).orderBy(desc(actorReceipts.createdAt));
      setReceiptsList(list);
    } catch (e: any) {
      console.error('Failed to load receipts:', e);
      setErrorMsg(e.message || 'Failed to load receipts');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const renderReceiptItem = ({ item }: { item: any }) => {
    const isError = !!item.error;
    return (
      <AdminCard
        title={`Receipt: ${item.id.slice(0, 8)}...`}
        subtitle={new Date(item.createdAt).toLocaleString()}
        headerRight={<ReceiptBadge status={item.status} />}
        style={isError ? styles.cardError : undefined}
      >
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Command ID</Text>
            <Text style={styles.valueMono}>{item.commandId}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.label}>Actor Target</Text>
            <ActorRefView actorRef={item.actorRef} />
          </View>

          {item.deltaHash && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.label}>Delta Hash</Text>
                <Text style={styles.valueMono}>{item.deltaHash.slice(0, 16)}...</Text>
              </View>
            </>
          )}

          {item.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorLabel}>Failure Reason</Text>
              <Text style={styles.errorText}>{item.error}</Text>
            </View>
          )}

          <View style={styles.jsonWrapper}>
            <JsonInspector
              data={{ eventIds: JSON.parse(item.eventIds || '[]') }}
              title="Event Payloads"
            />
          </View>
        </View>
      </AdminCard>
    );
  };

  return (
    <AdminShell
      title="Receipt Audit Logs"
      subtitle="Historical transaction log matching BEAM event receipts"
      scrollable={false}
    >
      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
      <FlatList
        data={receiptsList}
        renderItem={renderReceiptItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchReceipts}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconPlaceholder}>
              <Text style={styles.emptyIconText}>🧾</Text>
            </View>
            <Text style={styles.emptyTitle}>No Receipts Found</Text>
            <Text style={styles.emptyText}>Dispatched commands will appear here.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardError: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  detailsContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 10,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueMono: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
    color: '#E2E8F0',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
  },
  errorLabel: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#FCA5A5',
    fontFamily: 'SpaceMono',
    fontSize: 12,
    lineHeight: 18,
  },
  jsonWrapper: {
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});

import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';

export default function AdminPrayer() {
  const prayers = [
    {
      id: '1',
      request: 'Healing for Mrs. Henderson during chemotherapy.',
      submittedBy: 'John Henderson',
      visibility: 'Pastors Only',
      date: '2h ago',
    },
    {
      id: '2',
      request: 'Safe travels for the youth mission team.',
      submittedBy: 'Michael Chang',
      visibility: 'Public Community',
      date: '1d ago',
    },
    {
      id: '3',
      request: 'Guidance in finding a new group coordinator.',
      submittedBy: 'Sarah Jenkins',
      visibility: 'Staff Only',
      date: '3d ago',
    },
  ];

  const getVisibilityColor = (vis: string) => {
    switch (vis) {
      case 'Pastors Only':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' };
      case 'Staff Only':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' };
    }
  };

  const renderItem = ({ item }: { item: (typeof prayers)[0] }) => {
    const visColors = getVisibilityColor(item.visibility);

    return (
      <AdminCard
        title={item.submittedBy}
        subtitle={`Submitted ${item.date}`}
        headerRight={
          <View style={[styles.badge, { backgroundColor: visColors.bg }]}>
            <Text style={[styles.badgeText, { color: visColors.text }]}>{item.visibility}</Text>
          </View>
        }
      >
        <View style={styles.contentBox}>
          <Text style={styles.reqText}>"{item.request}"</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Praying</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.actionBtn, styles.actionBtnOutline]}>
            <Text style={styles.actionBtnOutlineText}>Change Visibility</Text>
          </Pressable>
        </View>
      </AdminCard>
    );
  };

  return (
    <AdminShell
      title="Community Prayer Requests"
      subtitle="Monitor prayer needs and visibility policies"
    >
      <FlatList
        data={prayers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 24,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  contentBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    marginBottom: 12,
  },
  reqText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    flex: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  actionBtnOutlineText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});

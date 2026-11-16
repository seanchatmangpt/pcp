import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';

export default function AdminVolunteers() {
  const assignments = [
    {
      id: '1',
      team: 'Welcoming / Ushers',
      count: 12,
      coordinator: 'Sarah Jenkins',
      status: 'Optimal',
    },
    {
      id: '2',
      title: 'Worship / AV Sound',
      count: 6,
      coordinator: 'Michael Chang',
      status: 'Needs Volunteers',
    },
    {
      id: '3',
      title: 'Kids Church Helpers',
      count: 14,
      coordinator: 'Jenny Choi',
      status: 'Optimal',
    },
  ];

  const renderItem = ({ item }: { item: (typeof assignments)[0] }) => {
    const isNeedsVols = item.status === 'Needs Volunteers';
    return (
      <AdminCard
        title={item.team || item.title}
        subtitle={`${item.count} Volunteers`}
        headerRight={
          <View style={[styles.badge, isNeedsVols ? styles.badgeWarning : styles.badgeSuccess]}>
            <Text
              style={[
                styles.badgeText,
                isNeedsVols ? styles.badgeTextWarning : styles.badgeTextSuccess,
              ]}
            >
              {item.status}
            </Text>
          </View>
        }
      >
        <View style={styles.coordRow}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.coordinator.charAt(0)}</Text>
          </View>
          <View style={styles.coordInfo}>
            <Text style={styles.label}>Coordinator</Text>
            <Text style={styles.val}>{item.coordinator}</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Manage</Text>
          </Pressable>
        </View>
      </AdminCard>
    );
  };

  return (
    <AdminShell title="Volunteer Assignments" subtitle="Volunteer ministries team allocations">
      <FlatList
        data={assignments}
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
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 14,
  },
  coordInfo: {
    flex: 1,
  },
  label: {
    color: '#94A3B8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  val: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgeTextSuccess: {
    color: '#10B981',
  },
  badgeTextWarning: {
    color: '#F59E0B',
  },
  actionBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  actionBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
});

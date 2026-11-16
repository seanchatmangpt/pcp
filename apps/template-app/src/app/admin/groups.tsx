import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AdminGroups() {
  const groups = [
    {
      id: '1',
      name: 'Downtown Community Group',
      leader: 'Pastor David Choi',
      members: '14 members',
    },
    {
      id: '2',
      name: 'Westside Families Fellowship',
      leader: 'Sarah Jenkins',
      members: '18 members',
    },
    { id: '3', name: 'College & Young Adults', leader: 'Michael Chang', members: '22 members' },
  ];

  return (
    <AdminShell title="Small Groups & Ministries" subtitle="Manage campus small groups and leaders">
      <ScrollView contentContainerStyle={styles.container}>
        {groups.map((item) => (
          <TouchableOpacity accessibilityRole="button" key={item.id} activeOpacity={0.8}>
            <AdminCard title={item.name} subtitle={item.members}>
              <View style={styles.leaderRow}>
                <FontAwesome name="users" size={14} color="#94A3B8" style={styles.icon} />
                <Text style={styles.label}>Leader:</Text>
                <Text style={styles.val}>{item.leader}</Text>
              </View>
            </AdminCard>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    color: '#94A3B8',
    fontSize: 13,
    marginRight: 6,
    fontWeight: '600',
  },
  val: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AdminPeople() {
  const staff = [
    { id: '1', name: 'Pastor David Choi', role: 'Lead Pastor', email: 'david@zoecommunity.church' },
    {
      id: '2',
      name: 'Sarah Jenkins',
      role: 'Family Ministries Director',
      email: 'sarah@zoecommunity.church',
    },
    {
      id: '3',
      name: 'Michael Chang',
      role: 'Worship Director',
      email: 'michael@zoecommunity.church',
    },
  ];

  return (
    <AdminShell title="Pastoral Staff & Members" subtitle="Roster profiles of church leadership">
      <ScrollView contentContainerStyle={styles.container}>
        {staff.map((item) => (
          <TouchableOpacity accessibilityRole="button" key={item.id} activeOpacity={0.8}>
            <AdminCard title={item.name} subtitle={item.role}>
              <View style={styles.emailRow}>
                <FontAwesome name="envelope" size={14} color="#94A3B8" style={styles.icon} />
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.val}>{item.email}</Text>
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
  emailRow: {
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
    fontFamily: 'SpaceMono',
  },
});

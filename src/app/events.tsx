import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AdminEvents() {
  const events = [
    {
      id: '1',
      title: 'Sunday Morning Worship',
      time: 'Every Sunday, 9:00 AM & 11:00 AM',
      location: 'Main Sanctuary',
    },
    { id: '2', title: 'Midweek Prayer Gathering', time: 'Wednesdays, 7:00 PM', location: 'Chapel' },
    {
      id: '3',
      title: 'Community Outreach Service',
      time: 'Saturdays, 10:00 AM',
      location: 'Downtown Shelter',
    },
  ];

  return (
    <AdminShell
      title="Church Calendar Events"
      subtitle="Monitor scheduled services and outreach events"
    >
      <ScrollView contentContainerStyle={styles.container}>
        {events.map((item) => (
          <TouchableOpacity accessibilityRole="button" key={item.id} activeOpacity={0.8}>
            <AdminCard title={item.title} subtitle={item.time}>
              <View style={styles.locRow}>
                <FontAwesome name="map-marker" size={14} color="#94A3B8" style={styles.icon} />
                <Text style={styles.label}>Location:</Text>
                <Text style={styles.val}>{item.location}</Text>
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
  locRow: {
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

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AdminContent() {
  const announcements = [
    {
      id: '1',
      title: 'Summer Volunteer Training',
      date: 'May 28, 2026',
      desc: 'Join us for our annual volunteer training session in the main hall.',
    },
    {
      id: '2',
      title: 'Food Drive Campaign',
      date: 'June 05, 2026',
      desc: 'Drop off non-perishable food items at any campus lobby.',
    },
    {
      id: '3',
      title: 'Youth Group Summer Retreat',
      date: 'June 15, 2026',
      desc: 'Registration is open for the high school retreat at Lake Chelan.',
    },
  ];

  return (
    <AdminShell title="Content Management" subtitle="Manage announcement content feed cards">
      <ScrollView contentContainerStyle={styles.container}>
        {announcements.map((item) => (
          <TouchableOpacity accessibilityRole="button" key={item.id} activeOpacity={0.8}>
            <AdminCard title={item.title} subtitle={item.date}>
              <View style={styles.contentBox}>
                <FontAwesome name="bullhorn" size={14} color="#94A3B8" style={styles.icon} />
                <Text style={styles.bodyText}>{item.desc}</Text>
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
  contentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  icon: {
    marginRight: 10,
    marginTop: 2,
  },
  bodyText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
});

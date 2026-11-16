import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AdminChurch() {
  return (
    <AdminShell title="Church Profile" subtitle="Manage Schema.org Church metadata profile">
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.8}>
          <AdminCard title="Identity details" subtitle="Vocabulary: https://schema.org/Church">
            <View style={styles.cardContent}>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="tag" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>@type:</Text>
                </View>
                <Text style={styles.valMono}>Church</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="id-badge" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Name:</Text>
                </View>
                <Text style={styles.val}>Zoe Community Church</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="calendar" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Founding Date:</Text>
                </View>
                <Text style={styles.val}>2024-04-12</Text>
              </View>
            </View>
          </AdminCard>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" activeOpacity={0.8}>
          <AdminCard
            title="Location details"
            subtitle="Vocabulary: https://schema.org/PostalAddress"
          >
            <View style={styles.cardContent}>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="map-marker" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Street Address:</Text>
                </View>
                <Text style={styles.val}>1200 Cathedral Way</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="building" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Address Locality:</Text>
                </View>
                <Text style={styles.val}>Seattle</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="map" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Address Region:</Text>
                </View>
                <Text style={styles.val}>WA</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome
                    name="envelope-square"
                    size={12}
                    color="#94A3B8"
                    style={styles.icon}
                  />
                  <Text style={styles.label}>Postal Code:</Text>
                </View>
                <Text style={styles.val}>98101</Text>
              </View>
            </View>
          </AdminCard>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" activeOpacity={0.8}>
          <AdminCard title="Contact points" subtitle="Official channels">
            <View style={styles.cardContent}>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="envelope" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Email:</Text>
                </View>
                <Text style={styles.val}>info@zoecommunity.church</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="phone" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>Telephone:</Text>
                </View>
                <Text style={styles.val}>(206) 555-0199</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.labelContainer}>
                  <FontAwesome name="globe" size={12} color="#94A3B8" style={styles.icon} />
                  <Text style={styles.label}>URL:</Text>
                </View>
                <Text style={styles.val}>https://zoecommunity.church</Text>
              </View>
            </View>
          </AdminCard>
        </TouchableOpacity>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  cardContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
    width: 14,
    textAlign: 'center',
  },
  label: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  val: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  valMono: {
    color: '#3B82F6',
    fontSize: 12,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
  },
});

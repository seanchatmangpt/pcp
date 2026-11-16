import React from 'react';
import { ScrollView, Text, Image, View, StyleSheet } from 'react-native';

export default function VerifyScreen() {
  const proofs = [
    { name: 'Index Route', image: require('../../assets/proofs/route_index_proof.png') },
    { name: 'OpenAI Route', image: require('../../assets/proofs/route_openai_proof.png') },
    { name: 'Process Route', image: require('../../assets/proofs/route_process_proof.png') },
    { name: 'Audit Route', image: require('../../assets/proofs/route_audit_proof.png') },
    { name: 'Account Route', image: require('../../assets/proofs/route_account_proof.png') },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Route Integrity Validation</Text>
      <Text style={styles.subtitle}>
        All route screenshots successfully captured from the live iOS Simulator.
      </Text>

      {proofs.map((proof, idx) => (
        <View key={idx} style={styles.card}>
          <Text style={styles.cardTitle}>{proof.name}</Text>
          <Image source={proof.image} style={styles.image} resizeMode="contain" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00e676',
    marginBottom: 8,
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 30,
  },
  card: {
    marginBottom: 40,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
});

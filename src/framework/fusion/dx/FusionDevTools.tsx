import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocExplorer } from '../../core/docs/DocExplorer';
import { blueprints } from '../../compositions/blueprints';

/**
 * FusionDevTools - A floating developer tools component.
 * Rendered in DEV mode only, provides quick access to documentation
 * and auto-scaffolding of features using blueprints.
 */
export const FusionDevTools: React.FC = () => {
  // Only render in development
  if (!__DEV__) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'docs' | 'scaffold'>('docs');

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsOpen(true)}
        testID="fusion-devtools-fab"
        activeOpacity={0.7}>
        <MaterialCommunityIcons name="fountain-pen-tip" size={24} color="white" />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
        testID="fusion-devtools-modal">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Fusion DX Tools</Text>
              <Text style={styles.headerSubtitle}>Swarm Integration Layer</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              testID="close-devtools"
              style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'docs' && styles.activeTab]}
              onPress={() => setActiveTab('docs')}
              testID="tab-docs">
              <MaterialCommunityIcons
                name="book-open-variant"
                size={18}
                color={activeTab === 'docs' ? '#3b82f6' : '#64748b'}
              />
              <Text style={[styles.tabText, activeTab === 'docs' && styles.activeTabText]}>
                Docs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'scaffold' && styles.activeTab]}
              onPress={() => setActiveTab('scaffold')}
              testID="tab-scaffold">
              <MaterialCommunityIcons
                name="auto-fix"
                size={18}
                color={activeTab === 'scaffold' ? '#3b82f6' : '#64748b'}
              />
              <Text style={[styles.tabText, activeTab === 'scaffold' && styles.activeTabText]}>
                Scaffold
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {activeTab === 'docs' ? <DocExplorer /> : <ScaffoldView />}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const ScaffoldView = () => {
  const [scaffolding, setScaffolding] = useState<string | null>(null);

  const handleScaffold = (id: string, name: string) => {
    setScaffolding(id);
    // Simulate scaffolding
    setTimeout(() => {
      setScaffolding(null);
      // In a real environment, this would call a dev server or write to FS
      console.log(`Successfully scaffolded: ${name}`);
    }, 1500);
  };

  return (
    <ScrollView style={styles.scaffoldContainer} testID="scaffold-view">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Missing Feature Scaffolding</Text>
        <Text style={styles.sectionDesc}>
          Pick a blueprint to auto-generate missing architecture layers.
        </Text>
      </View>

      {Object.entries(blueprints).map(([id, blueprint]) => (
        <View key={id} style={styles.blueprintCard} testID={`blueprint-card-${id}`}>
          <View style={styles.blueprintInfo}>
            <Text style={styles.blueprintName}>{blueprint.name}</Text>
            <Text style={styles.blueprintDesc}>{blueprint.description}</Text>
          </View>
          <TouchableOpacity
            style={[styles.scaffoldButton, scaffolding === id && styles.scaffoldButtonDisabled]}
            onPress={() => handleScaffold(id, blueprint.name)}
            disabled={scaffolding !== null}
            testID={`scaffold-btn-${id}`}>
            <Text style={styles.scaffoldButtonText}>
              {scaffolding === id ? 'Generative...' : 'Scaffold'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.footerInfo}>
        <MaterialCommunityIcons name="information-outline" size={14} color="#94a3b8" />
        <Text style={styles.footerText}>
          Blueprints are sourced from src/framework/compositions/blueprints
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  tabs: {
    flexDirection: 'row',
    padding: 6,
    backgroundColor: '#f1f5f9',
    margin: 16,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  content: {
    flex: 1,
  },
  scaffoldContainer: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  blueprintCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  blueprintInfo: {
    flex: 1,
    marginRight: 16,
  },
  blueprintName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#334155',
  },
  blueprintDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 18,
  },
  scaffoldButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  scaffoldButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  scaffoldButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 40,
    opacity: 0.6,
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

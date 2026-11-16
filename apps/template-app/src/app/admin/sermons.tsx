import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { AlertManager as Alert } from '../../framework/ui/dialog/AlertManager';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { CommandButton } from '../../components/admin/CommandButton';
import { ReceiptBadge } from '../../components/admin/ReceiptBadge';
import { globalLocalDispatcher, useActorOpsStore } from '@/src/lib/actor/actorOps';
import { CommandEnvelope } from '../../lib/actor/types';

export default function AdminSermons() {
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [dispatchReceipt, setDispatchReceipt] = useState<any | null>(null);
  const [isFocusedTitle, setIsFocusedTitle] = useState(false);
  const [isFocusedUrl, setIsFocusedUrl] = useState(false);

  const { currentPrincipal } = useActorOpsStore();

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Sermon Title cannot be empty.');
      return;
    }

    const commandId = `cmd_${Math.random().toString(36).substr(2, 9)}`;
    const actorId = `sermon_${Math.random().toString(36).substr(2, 5)}`;

    const envelope: CommandEnvelope = {
      id: commandId,
      actor: {
        tenantId: 'tenant-123',
        kind: 'Sermon',
        id: actorId,
      },
      command: 'PublishSermon',
      principal: currentPrincipal,
      payload: {
        title: title.trim(),
        videoUrl: videoUrl.trim(),
      },
      idempotencyKey: `idemp_${commandId}`,
    };

    try {
      const receipt = await globalLocalDispatcher.dispatch(envelope);
      setDispatchReceipt(receipt);
      if (receipt.status === 'accepted_pending') {
        Alert.alert('Command Dispatched', 'Sermon published locally! Command is queued in outbox.');
        setTitle('');
        setVideoUrl('');
      } else {
        Alert.alert('Rejection', `Execution rejected: ${receipt.error}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <AdminShell
      title="Sermons Directory"
      subtitle="Publish sermons via actor command routing fabric"
    >
      <AdminCard
        title="Publish New Sermon"
        subtitle="Dispatches 'PublishSermon' event to SermonActor"
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Sermon Title</Text>
          <TextInput
            style={[styles.input, isFocusedTitle && styles.inputFocused]}
            placeholder="e.g. The Power of Grace"
            placeholderTextColor="#475569"
            value={title}
            onChangeText={setTitle}
            onFocus={() => setIsFocusedTitle(true)}
            onBlur={() => setIsFocusedTitle(false)}
            testID="sermon-title-input"
            accessibilityLabel="Sermon Title"
            accessibilityHint="Enter the title of the sermon"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>
            Sermon Video URL <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, isFocusedUrl && styles.inputFocused]}
            placeholder="e.g. https://example.com/sermon.mp4"
            placeholderTextColor="#475569"
            value={videoUrl}
            onChangeText={setVideoUrl}
            onFocus={() => setIsFocusedUrl(true)}
            onBlur={() => setIsFocusedUrl(false)}
            autoCapitalize="none"
            keyboardType="url"
            testID="sermon-video-input"
            accessibilityLabel="Sermon Video URL"
            accessibilityHint="Enter the video URL for the sermon (optional)"
          />
        </View>

        <CommandButton
          title="Publish Sermon"
          onPress={handlePublish}
          testID="publish-sermon-submit"
          style={styles.submitBtn}
        />
      </AdminCard>

      {dispatchReceipt && (
        <AdminCard title="Execution Receipt Output" subtitle="Result feedback from Dispatcher">
          <View style={styles.receiptContainer}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Status</Text>
              <ReceiptBadge status={dispatchReceipt.status} testID="receipt-status" />
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Command ID</Text>
              <Text style={styles.valueMono}>{dispatchReceipt.commandId}</Text>
            </View>

            {dispatchReceipt.error && (
              <View style={styles.errorContainer}>
                <View style={styles.errorHeader}>
                  <Text style={styles.errorLabel}>Rejection Details</Text>
                  <Text style={styles.errorText} testID="latest-error-code">
                    {dispatchReceipt.error.includes('AuthorizationError')
                      ? 'AUTHZ_DENIED'
                      : 'INPUT_INVALID'}
                  </Text>
                </View>
                <Text style={styles.errorSubText}>{dispatchReceipt.error}</Text>
              </View>
            )}
          </View>
        </AdminCard>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E2E8F0',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    color: '#64748B',
    fontWeight: 'normal',
    textTransform: 'none',
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 8,
    padding: 14,
    color: '#F8FAFC',
    fontSize: 15,
  },
  inputFocused: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
  },
  receiptContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 12,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
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
    marginTop: 16,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  errorLabel: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#EF4444',
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorSubText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
});

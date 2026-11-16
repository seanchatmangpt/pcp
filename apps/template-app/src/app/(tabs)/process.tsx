import React, { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useOcelEvidence } from '@/src/hooks/useOcelEvidence';
import { ProcessEvidenceView } from '@/src/components/ProcessEvidenceView';
import { ProtectedRoute } from '@/src/route-law/ProtectedRoute';
import { Skeleton } from '../../framework/ui/Skeleton';

function ProcessListSkeleton() {
  return (
    <ScrollView className="flex-1 p-4 bg-slate-50">
      <View className="mb-6">
        <Skeleton width={180} height={24} borderRadius={4} className="mb-4 bg-slate-200/60" />
        {[1, 2].map((i) => (
          <View key={i} className="p-4 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm gap-2">
            <Skeleton width={120} height={18} borderRadius={4} className="mb-2 bg-slate-200/60" />
            <Skeleton width={80} height={12} borderRadius={4} className="bg-slate-200/60" />
          </View>
        ))}
      </View>

      <View>
        <Skeleton width={140} height={24} borderRadius={4} className="mb-4 bg-slate-200/60" />
        {[1, 2, 3].map((i) => (
          <View key={i} className="p-4 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm gap-2">
            <View className="flex-row justify-between items-center mb-1">
              <Skeleton width={150} height={18} borderRadius={4} className="mb-2 bg-slate-200/60" />
              <Skeleton width={80} height={12} borderRadius={4} className="bg-slate-200/60" />
            </View>
            <Skeleton width={100} height={12} borderRadius={4} className="bg-slate-200/60" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function ProcessScreen() {
  const { evidence, isLoading, loadEvidence } = useOcelEvidence();

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  return (
    <ProtectedRoute route={{ requiredIdentityBoundary: 'verified', requiredReceiptCommandId: 'cmd_process_access' }}>
      <View className="flex-1">
        <View className="p-6 bg-white border-b border-slate-200">
          <Text className="text-2xl font-black text-slate-900">PROCESS INTELLIGENCE</Text>
          <Text className="text-ss text-slate-500 uppercase tracking-widest">
            State: {evidence?._state || 'Unknown'} | Witness: {evidence?._witness || 'None'}
          </Text>
        </View>
        {isLoading ? (
          <ProcessListSkeleton />
        ) : (
          evidence && <ProcessEvidenceView log={evidence.value} />
        )}
      </View>
    </ProtectedRoute>
  );
}


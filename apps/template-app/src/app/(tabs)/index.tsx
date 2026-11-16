import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSession } from '@/context/SessionProvider';
import { Ionicons } from '@expo/vector-icons';
import { PostCyberpunkProvider } from '@pcp/framework/v30/post-cyberpunk/core/PostCyberpunkProvider';
import { useLawEngine } from '@pcp/framework/v30/post-cyberpunk/law-engine';
import { useAgiCourt } from '@pcp/framework/v30/post-cyberpunk/agi-court';
import { GlassCard } from '@pcp/framework/ui/glassmorphism/GlassCard';
import { HolographicGlassCard } from '@pcp/framework/2030/ui-holographic/HolographicGlassCard';
import { Skeleton } from '../../framework/ui/Skeleton';

function DashboardSkeleton() {
  return (
    <ScrollView
      className="flex-1 bg-[#090d16]"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 120 }}
    >
      <View className="mb-10">
        <Skeleton width={220} height={36} borderRadius={8} className="mb-2 bg-slate-800/40" />
        <Skeleton width={180} height={16} borderRadius={4} className="bg-slate-800/40" />
      </View>

      {/* Reality Actuator Card Skeleton */}
      <View className="p-6 mb-8 bg-[#0f172a]/90 rounded-[24px] border border-slate-800/60 shadow-xl shadow-slate-950/20">
        <View className="flex-row items-center mb-6">
          <Skeleton width={48} height={48} borderRadius={16} className="mr-4 bg-slate-800/40" />
          <View className="flex-1">
            <Skeleton width={140} height={20} borderRadius={4} className="mb-2 bg-slate-800/40" />
            <Skeleton width={90} height={14} borderRadius={4} className="bg-slate-800/40" />
          </View>
        </View>
        <Skeleton width="100%" height={56} borderRadius={16} className="bg-slate-800/40" />
      </View>

      {/* Metrics Row Skeleton */}
      <View className="flex-row mb-8">
        <View className="flex-1 mr-2 p-5 h-32 bg-[#0f172a]/90 rounded-2xl border border-slate-800/60 justify-between">
          <Skeleton width={20} height={20} borderRadius={10} className="bg-slate-800/40" />
          <View>
            <Skeleton width={70} height={12} borderRadius={4} className="mb-2 bg-slate-800/40" />
            <Skeleton width={60} height={20} borderRadius={4} className="bg-slate-800/40" />
          </View>
        </View>
        <View className="flex-1 ml-2 p-5 h-32 bg-[#0f172a]/90 rounded-2xl border border-slate-800/60 justify-between">
          <Skeleton width={20} height={20} borderRadius={10} className="bg-slate-800/40" />
          <View>
            <Skeleton width={70} height={12} borderRadius={4} className="mb-2 bg-slate-800/40" />
            <Skeleton width={60} height={20} borderRadius={4} className="bg-slate-800/40" />
          </View>
        </View>
      </View>

      {/* AGI Court Card Skeleton */}
      <View className="bg-[#0f172a]/90 border border-slate-800/60 rounded-3xl p-6 mb-12 shadow-xl shadow-slate-950/20">
        <Skeleton width={160} height={14} borderRadius={4} className="mb-6 bg-slate-800/40" />
        <View className="space-y-4">
          {[1, 2, 3].map((i) => (
            <View key={i} className="flex-row justify-between items-center py-2.5 border-b border-slate-800/30">
              <Skeleton width={110} height={16} borderRadius={4} className="bg-slate-800/40" />
              <Skeleton width={50} height={14} borderRadius={4} className="bg-slate-800/40" />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * ZOEapp Dashboard (Post-Cyberpunk Edition)
 * An Expo/Supabase application surface powered by the PCP Framework.
 */
export default function PcpDashboard() {
  const { session, loading } = useSession();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PostCyberpunkProvider systemSecret="zoe-secret" laws={[]}>
      <DashboardContent user={session?.user} />
    </PostCyberpunkProvider>
  );
}

function DashboardContent({ user }: { user: any }) {
  const { submitClaim } = useLawEngine({
    laws: [],
    boundary: {
      execute: async () => ({
        id: 'r1',
        artifactId: 'a1',
        executionTime: Date.now(),
        status: 'SUCCESS',
      }),
    },
  });
  const [actuationStatus, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const handleActuation = async () => {
    setStatus('processing');
    // Simulate a Blue River Dam lifecycle transition
    await submitClaim({
      id: `act_${Date.now()}`,
      description: 'Actuating ministry context via Post-Cyberpunk law',
      requiredEvidence: ['ZKP_AUTH', 'HARDWARE_ATTESTATION'],
    } as any);
    setStatus('success');
    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 120 }}
    >
      <View className="mb-10">
        <Text className="text-4xl font-black text-slate-900 dark:text-text tracking-tighter mb-2">PCP DASHBOARD</Text>
        <Text className="text-slate-400 text-lg font-medium">
          Post-Cyberpunk Operating Substrate
        </Text>
      </View>

      <HolographicGlassCard className="p-6 mb-8">
        <View className="flex-row items-center mb-4">
          <View className="bg-violet-500/20 p-3 rounded-2xl mr-4">
            <Ionicons name="shield-checkmark" size={24} color="#A78BFA" />
          </View>
          <View>
            <Text className="text-white text-xl font-bold">Reality Actuator</Text>
            <Text className="text-slate-400 text-sm">Blue River Dam v30.1.2</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleActuation}
          disabled={actuationStatus === 'processing'}
          className={`h-14 rounded-2xl items-center justify-center ${
            actuationStatus === 'processing' ? 'bg-slate-800' : 'bg-violet-600'
          }`}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Actuate Reality Law"
        >
          {actuationStatus === 'processing' ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">
              {actuationStatus === 'success' ? 'REALITY MANUFACTURED' : 'ACTUATE LAW'}
            </Text>
          )}
        </TouchableOpacity>
      </HolographicGlassCard>

      <View className="flex-row space-x-4 mb-8">
        <View className="flex-1">
          <GlassCard intensity="low" className="p-5 h-32 justify-between">
            <Ionicons name="people" size={20} color="#94A3B8" />
            <View>
              <Text className="text-slate-500 text-xs font-bold uppercase">Community</Text>
              <Text className="text-white text-xl font-black">ACTIVE</Text>
            </View>
          </GlassCard>
        </View>
        <View className="flex-1">
          <GlassCard intensity="low" className="p-5 h-32 justify-between">
            <Ionicons name="radio" size={20} color="#94A3B8" />
            <View>
              <Text className="text-slate-500 text-xs font-bold uppercase">Livestream</Text>
              <Text className="text-emerald-400 text-xl font-black">LIVE</Text>
            </View>
          </GlassCard>
        </View>
      </View>

      <View className="bg-card/50 border border-border rounded-3xl p-6 mb-12">
        <Text className="text-slate-300 font-bold mb-4 uppercase tracking-widest text-xs">
          Internal Court (AGI Court)
        </Text>
        <View className="space-y-3">
          {[
            { label: 'Witness Lattice', status: 'ADMITTED' },
            { label: 'ZKP Boundary', status: 'VERIFIED' },
            { label: 'Causal Window', status: 'GATED' },
          ].map((item, i) => (
            <View
              key={i}
              className="flex-row justify-between items-center py-2 border-b border-slate-800/50"
            >
              <Text className="text-slate-400 font-medium">{item.label}</Text>
              <Text className="text-violet-400 font-mono text-xs font-bold">{item.status}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="items-center opacity-30">
        <Text className="text-slate-500 font-mono text-[10px]">
          SESSION_ID: {user?.id?.slice(0, 12)}...
        </Text>
        <Text className="text-slate-500 font-mono text-[10px]">PCP_FOUNDRY_V30_OMEGA</Text>
      </View>
    </ScrollView>
  );
}

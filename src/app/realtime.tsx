import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { AvatarRelativeProjectionMatrixView } from '../../components/AvatarRelativeProjection';
import { supabase } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Message {
  id: string;
  channel: string;
  payload: any;
  timestamp: string;
}

interface MessageItemProps {
  msg: Message;
}

function MessageItem({ msg }: MessageItemProps) {
  const getChannelConfig = (channel: string) => {
    switch (channel) {
      case 'actor_commands':
        return {
          color: '#3B82F6',
          icon: 'bolt',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
        }; // Blue
      case 'actor_events':
        return {
          color: '#8B5CF6',
          icon: 'rss',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
        }; // Purple
      case 'actor_receipts':
        return {
          color: '#10B981',
          icon: 'check-circle',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
        }; // Green
      case 'rdf_quads_ld':
        return {
          color: '#06B6D4',
          icon: 'cube',
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/20',
        }; // Cyan
      default:
        return {
          color: '#64748B',
          icon: 'database',
          bg: 'bg-slate-500/10',
          border: 'border-slate-500/20',
        }; // Slate
    }
  };

  const config = getChannelConfig(msg.channel);

  return (
    <Animated.View entering={FadeInUp.duration(300)}>
      <View className={`mb-3 rounded-xl border ${config.border} bg-[#0f172a]/90 overflow-hidden`}>
        <View className="flex-row items-center justify-between px-3 py-2 bg-black/20 border-b border-white/5">
          <View className="flex-row items-center space-x-2">
            <FontAwesome
              name={config.icon as any}
              size={12}
              color={config.color}
              style={{ marginRight: 6 }}
            />
            <Text
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: config.color }}
            >
              {msg.channel}
            </Text>
          </View>
          <Text className="text-[10px] text-slate-500 font-medium">{msg.timestamp}</Text>
        </View>
        <View className="p-3">
          <Text className="text-[11px] text-slate-300 font-mono leading-relaxed">
            {JSON.stringify(msg.payload, null, 2)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
const generateSimulatedPayload = (channel: string): any => {
  if (channel === 'actor_commands') {
    const cmds = ['volunteer_signup', 'volunteer_cancel', 'confirm_shift', 'flag_shortage'];
    const roles = ['member', 'volunteer', 'teamLead', 'pastor'];
    return {
      action: 'INSERT',
      table: 'actor_commands',
      record: {
        id: 'cmd_' + Math.random().toString(36).substring(2, 11),
        command: cmds[Math.floor(Math.random() * cmds.length)],
        actor_ref: 'volunteer_shortage',
        principal: { role: roles[Math.floor(Math.random() * roles.length)], id: 'usr_abc' },
        timestamp: new Date().toISOString(),
      },
    };
  } else if (channel === 'actor_events') {
    const events = ['slot_opened', 'shift_assigned', 'risk_acknowledged'];
    return {
      action: 'INSERT',
      table: 'actor_events',
      record: {
        id: 'evt_' + Math.random().toString(36).substring(2, 11),
        command_id: 'cmd_' + Math.random().toString(36).substring(2, 11),
        type: events[Math.floor(Math.random() * events.length)],
        payload: { detail: 'Simulated realtime event logging' },
        timestamp: new Date().toISOString(),
      },
    };
  } else if (channel === 'actor_receipts') {
    const statuses = ['Confirmed', 'Rejected_Remote', 'accepted_pending'];
    return {
      action: 'INSERT',
      table: 'actor_receipts',
      record: {
        id: 'rec_' + Math.random().toString(36).substring(2, 11),
        command_id: 'cmd_' + Math.random().toString(36).substring(2, 11),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        delta_hash: 'hash_' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
      },
    };
  } else if (channel === 'rdf_quads_ld') {
    const subjects = ['volunteer_123', 'shift_abc', 'risk_summary_default'];
    const predicates = ['has_status', 'allocated_to', 'shortage_ratio'];
    const objects = ['shortage', 'Sarah Brown', '0.62'];
    return {
      action: 'UPSERT',
      table: 'rdf_quads_ld',
      record: {
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        predicate: predicates[Math.floor(Math.random() * predicates.length)],
        object: objects[Math.floor(Math.random() * objects.length)],
        graph: 'default_graph',
      },
    };
  }
  return {};
};

export default function AdminRealtime() {
  const [isConnected, setIsConnected] = React.useState(true);
  const [latency, setLatency] = React.useState(42);
  const [messages, setMessages] = React.useState<Message[]>(() => [
    {
      id: 'msg-init-0',
      channel: 'system_status',
      payload: { status: 'initialized' },
      timestamp: new Date(Date.now() - 15000).toLocaleTimeString(),
    },
    {
      id: 'msg-init-1',
      channel: 'rdf_quads_ld',
      payload: {
        action: 'UPSERT',
        table: 'rdf_quads_ld',
        record: { subject: 'volunteer_123', predicate: 'has_status', object: 'shortage' },
      },
      timestamp: new Date(Date.now() - 10000).toLocaleTimeString(),
    },
    {
      id: 'msg-init-2',
      channel: 'actor_commands',
      payload: {
        action: 'INSERT',
        table: 'actor_commands',
        record: {
          command: 'volunteer_cancel',
          actor_ref: 'volunteer_shortage',
          principal: 'member',
        },
      },
      timestamp: new Date(Date.now() - 5000).toLocaleTimeString(),
    },
  ]);

  const pulse = useSharedValue(1);

  React.useEffect(() => {
    const duration = isConnected ? 1200 : 400;
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration }),
        withTiming(1, { duration })
      ),
      -1,
      false
    );
  }, [isConnected]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        setLatency((prev) => {
          const diff = Math.floor(Math.random() * 11) - 5;
          return Math.max(12, Math.min(150, prev + diff));
        });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isConnected]);

  const addMessage = React.useCallback((channel: string, payload: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) => [
      {
        id: 'msg-' + Math.random().toString(36).substring(2, 11),
        channel,
        payload,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 19),
    ]);
  }, []);

  React.useEffect(() => {
    if (!isConnected) return;

    const channel = supabase
      .channel('admin-realtime-cdc')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'actor_commands' },
        (payload) => {
          addMessage('actor_commands', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'actor_events' },
        (payload) => {
          addMessage('actor_events', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'actor_receipts' },
        (payload) => {
          addMessage('actor_receipts', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rdf_quads_ld' },
        (payload) => {
          addMessage('rdf_quads_ld', payload);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConnected, addMessage]);

  const simulateMessage = (channel: string) => {
    const payload = generateSimulatedPayload(channel);
    addMessage(channel, payload);
  };

  const clearMessages = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages([]);
  };

  return (
    <AdminShell
      title="Realtime Channels"
      subtitle="Authoritative CDC and message subscription channels"
    >
      {/* Supabase connection status */}
      <AdminCard
        title="Supabase Realtime Status"
        subtitle="Socket and subscription states"
        headerRight={
          <TouchableOpacity
            activeOpacity={0.7}
            className={`px-3 py-1.5 rounded-lg border flex-row items-center shadow-sm ${isConnected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}
            onPress={() => setIsConnected(!isConnected)}
          >
            <FontAwesome
              name={isConnected ? 'wifi' : 'warning'}
              size={12}
              color={isConnected ? '#10B981' : '#F43F5E'}
              style={{ marginRight: 6 }}
            />
            <Text
              className={`text-xs font-bold tracking-wide ${isConnected ? 'text-emerald-500' : 'text-rose-500'}`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>
        }
      >
        <View className="space-y-3 mt-2">
          <View className="flex-row justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
            <View className="flex-row items-center space-x-3">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${isConnected ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}
              >
                <Animated.View style={pulseStyle}>
                  <FontAwesome
                    name="circle"
                    size={12}
                    color={isConnected ? '#10B981' : '#F43F5E'}
                  />
                </Animated.View>
              </View>
              <View>
                <Text className="text-slate-400 text-xs font-medium mb-0.5">Connection State</Text>
                <Text
                  className={`text-sm font-bold ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {isConnected ? 'Connected' : 'Offline / Error'}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row space-x-3">
            <View className="flex-1 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
              <Text className="text-slate-400 text-xs font-medium mb-1">Client Mode</Text>
              <Text className="text-slate-200 text-sm font-semibold">Realtime v2</Text>
            </View>
            <View className="flex-1 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
              <Text className="text-slate-400 text-xs font-medium mb-1">Echo Latency</Text>
              <Text className="text-slate-200 text-sm font-mono font-bold">
                {isConnected ? `${latency}ms` : '—'}
              </Text>
            </View>
          </View>
        </View>
      </AdminCard>

      {/* Simulator Control Panel */}
      <AdminCard
        title="Real-Time Event Simulator"
        subtitle="Simulate database CDC inserts & updates"
      >
        <View className="flex-row flex-wrap gap-2 mt-2">
          {[
            { channel: 'actor_commands', label: '⚡ Command', color: 'blue' },
            { channel: 'actor_events', label: '⚡ Event', color: 'purple' },
            { channel: 'actor_receipts', label: '⚡ Receipt', color: 'emerald' },
            { channel: 'rdf_quads_ld', label: '⚡ RDF Quad', color: 'cyan' },
          ].map((item) => (
            <TouchableOpacity
              key={item.channel}
              activeOpacity={0.7}
              className={`flex-1 min-w-[45%] bg-slate-800/80 border border-slate-700 rounded-xl p-3 items-center justify-center shadow-sm border-l-4`}
              style={{
                borderLeftColor:
                  item.color === 'blue'
                    ? '#3B82F6'
                    : item.color === 'purple'
                      ? '#8B5CF6'
                      : item.color === 'emerald'
                        ? '#10B981'
                        : '#06B6D4',
              }}
              onPress={() => simulateMessage(item.channel)}
            >
              <Text className="text-slate-200 text-xs font-bold tracking-wide">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AdminCard>

      {/* Live subscription feed */}
      <AdminCard
        title="Live Messages Feed"
        subtitle="WebSocket packet log (latest first)"
        headerRight={
          messages.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.6}
              className="bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
              onPress={clearMessages}
            >
              <Text className="text-rose-400 text-xs font-bold">Clear Log</Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        <View className="mt-2" style={{ maxHeight: 450 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {messages.length > 0 ? (
              messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)
            ) : (
              <View className="py-12 items-center justify-center">
                <View className="w-16 h-16 rounded-full bg-slate-800/50 items-center justify-center mb-4 border border-slate-700/50">
                  <FontAwesome name="hourglass-o" size={24} color="#64748B" />
                </View>
                <Text className="text-slate-400 text-sm font-medium">
                  No real-time messages received yet.
                </Text>
                <Text className="text-slate-500 text-xs mt-1">Waiting for CDC events...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </AdminCard>

      {/* Projection Matrix */}
      <AdminCard
        title="Avatar Projection Matrix"
        subtitle="Authoritative permission filters for the current state"
      >
        <View className="mt-2 rounded-xl overflow-hidden border border-slate-700/50">
          <AvatarRelativeProjectionMatrixView />
        </View>
      </AdminCard>
    </AdminShell>
  );
}

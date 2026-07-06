import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { OcelLogTs } from '@wasm4pm/types';

interface Props {
  log: OcelLogTs;
}

export const ProcessEvidenceView: React.FC<Props> = ({ log }) => {
  return (
    <ScrollView className="flex-1 p-4 bg-slate-50">
      <View className="mb-6">
        <Text className="text-xl font-black text-slate-900 mb-4">PROCESS OBJECTS</Text>
        {log.objects.map((obj) => (
          <View
            key={obj.id}
            className="p-4 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm"
          >
            <Text className="font-bold text-indigo-600">{obj.id}</Text>
            <Text className="text-xs text-slate-500 uppercase tracking-widest">
              {obj.object_type}
            </Text>
          </View>
        ))}
      </View>

      <View>
        <Text className="text-xl font-black text-slate-900 mb-4">EVENT TRACE</Text>
        {log.events.map((evt) => (
          <View
            key={evt.id}
            className="p-4 mb-3 bg-white rounded-2xl border border-slate-200 shadow-sm"
          >
            <View className="flex-row justify-between items-center mb-1">
              <Text className="font-bold text-slate-800">{evt.activity}</Text>
              <Text className="text-[10px] text-slate-400 font-mono">ID: {evt.id}</Text>
            </View>
            {evt.timestamp_ns && (
              <Text className="text-[10px] text-slate-400">
                {new Date(Number((evt.timestamp_ns as any) / BigInt(1000000))).toLocaleString()}
              </Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

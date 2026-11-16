import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

export default function TabAdmin() {
  return (
    <View className="flex-1 justify-center items-center bg-background px-6">
      <Text className="text-2xl font-black text-text mb-6 text-center tracking-tight">
        ZOE Administration Console
      </Text>
      
      <Link href="/admin/actor-lab" asChild>
        <TouchableOpacity
          testID="enter-console-button"
          activeOpacity={0.7}
          className="bg-primary px-8 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-primary/20"
          style={{ minWidth: 200, minHeight: 48 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Enter Administration Console"
        >
          <Text className="text-white font-bold text-base">Enter Console</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

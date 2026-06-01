import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { analyzeError } from './analyzer';
import { SuggestedFix } from './types';

export interface AutoFixerProps {
  /** The error to analyze and fix */
  error: Error;
  /** Callback to reset the error state after a fix is applied */
  onReset: () => void;
}

/**
 * Intelligent Auto-Fixer UI component.
 * Analyzes the error and presents actionable suggestions to the user.
 */
export const AutoFixer: React.FC<AutoFixerProps> = ({ error, onReset }) => {
  const analysis = useMemo(() => analyzeError(error), [error]);

  const handleFix = async (fix: SuggestedFix) => {
    try {
      await fix.action();
      onReset();
    } catch (e) {
      console.error('Failed to apply auto-fix:', e);
    }
  };

  return (
    <View className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm mt-4">
      <View className="flex-row items-center mb-3">
        <View className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
        <Text className="text-slate-900 font-bold text-lg">Pcp Intelligent Repair</Text>
      </View>

      {analysis.causes.length > 0 && (
        <View className="mb-4">
          <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            Detected Analysis
          </Text>
          {analysis.causes.map((cause, index) => (
            <Text key={index} className="text-slate-700 text-sm italic">
              • {cause}
            </Text>
          ))}
        </View>
      )}

      <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
        Suggested Fixes
      </Text>

      <ScrollView className="max-h-64">
        {analysis.suggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            onPress={() => handleFix(suggestion)}
            className={`mb-3 p-3 rounded-lg border ${
              suggestion.impact === 'high'
                ? 'bg-red-50 border-red-100'
                : suggestion.impact === 'medium'
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-green-50 border-green-100'
            }`}>
            <View className="flex-row justify-between items-center mb-1">
              <Text className="font-semibold text-slate-900">{suggestion.title}</Text>
              <View
                className={`px-2 py-0.5 rounded-full ${
                  suggestion.impact === 'high'
                    ? 'bg-red-200'
                    : suggestion.impact === 'medium'
                      ? 'bg-amber-200'
                      : 'bg-green-200'
                }`}>
                <Text className="text-[10px] font-bold uppercase text-slate-800">
                  {suggestion.impact} Impact
                </Text>
              </View>
            </View>
            <Text className="text-slate-600 text-xs leading-4">{suggestion.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text className="text-slate-400 text-[10px] text-center mt-2 italic">
        Pcp Auto-Fix analyzing stack trace: {error.message.substring(0, 30)}...
      </Text>
    </View>
  );
};

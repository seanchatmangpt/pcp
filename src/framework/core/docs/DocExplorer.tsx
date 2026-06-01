import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { docRegistry } from './DocRegistry';
import { DocMetadata } from './types';
import { useTheme } from '../../ui/theme/useTheme';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DocExplorer: React.FC = () => {
  const theme = useTheme();
  const isDark = (theme as any).mode === 'dark';
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const docs = docRegistry.getAllDocs();

  const filteredDocs = useMemo(() => {
    return docs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.description.toLowerCase().includes(search.toLowerCase()) ||
        doc.type.toLowerCase().includes(search.toLowerCase())
    );
  }, [docs, search]);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedDocId),
    [docs, selectedDocId]
  );

  return (
    <View className={cn('flex-1 p-4', isDark ? 'bg-slate-900' : 'bg-slate-50')}>
      <Text className={cn('text-2xl font-bold mb-4', isDark ? 'text-white' : 'text-slate-900')}>
        Framework API Explorer
      </Text>

      <TextInput
        className={cn(
          'p-3 rounded-lg mb-4 border',
          isDark
            ? 'bg-slate-800 text-white border-slate-700'
            : 'bg-white text-slate-900 border-slate-200'
        )}
        placeholder="Search hooks, components, utilities..."
        placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
        value={search}
        onChangeText={setSearch}
      />

      <View className="flex-1 flex-row">
        {/* Sidebar */}
        <View className="w-1/3 pr-4 border-r border-slate-200 dark:border-slate-800">
          <ScrollView>
            {filteredDocs.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => setSelectedDocId(doc.id)}
                className={cn(
                  'p-3 rounded-md mb-2',
                  selectedDocId === doc.id
                    ? isDark
                      ? 'bg-blue-900'
                      : 'bg-blue-100'
                    : isDark
                      ? 'bg-slate-800'
                      : 'bg-slate-200'
                )}>
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                  {doc.name}
                </Text>
                <Text
                  className={cn(
                    'text-xs mt-1 opacity-70',
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  )}>
                  {doc.type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <View className="flex-1 pl-4">
          <ScrollView>
            {selectedDoc ? (
              <DocDetail doc={selectedDoc} isDark={isDark} />
            ) : (
              <View className="flex-1 justify-center items-center mt-20">
                <Text className={cn('text-lg', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Select an item to view documentation
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const DocDetail: React.FC<{ doc: DocMetadata; isDark: boolean }> = ({ doc, isDark }) => {
  return (
    <View>
      <View className="flex-row items-center mb-2">
        <Text className={cn('text-3xl font-bold mr-3', isDark ? 'text-white' : 'text-slate-900')}>
          {doc.name}
        </Text>
        <View className={cn('px-2 py-1 rounded', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
          <Text className={cn('text-xs font-mono', isDark ? 'text-slate-300' : 'text-slate-700')}>
            {doc.type}
          </Text>
        </View>
      </View>

      <Text className={cn('text-lg mb-6', isDark ? 'text-slate-300' : 'text-slate-700')}>
        {doc.description}
      </Text>

      {doc.params && doc.params.length > 0 && (
        <View className="mb-6">
          <Text className={cn('text-xl font-bold mb-3', isDark ? 'text-white' : 'text-slate-900')}>
            Parameters
          </Text>
          {doc.params.map((param, index) => (
            <View
              key={index}
              className={cn('p-3 rounded-lg mb-2', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
              <View className="flex-row items-center mb-1">
                <Text
                  className={cn(
                    'font-mono font-bold mr-2',
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  )}>
                  {param.name}
                </Text>
                <Text
                  className={cn(
                    'text-xs font-mono opacity-60',
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  )}>
                  {param.type}
                </Text>
              </View>
              <Text className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                {param.description}
              </Text>
            </View>
          ))}
        </View>
      )}

      {doc.returns && (
        <View className="mb-6">
          <Text className={cn('text-xl font-bold mb-3', isDark ? 'text-white' : 'text-slate-900')}>
            Returns
          </Text>
          <View className={cn('p-3 rounded-lg', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
            <Text
              className={cn(
                'font-mono text-sm mb-1',
                isDark ? 'text-green-400' : 'text-green-600'
              )}>
              {doc.returns.type}
            </Text>
            <Text className={isDark ? 'text-slate-300' : 'text-slate-600'}>
              {doc.returns.description}
            </Text>
          </View>
        </View>
      )}

      {doc.examples && doc.examples.length > 0 && (
        <View className="mb-6">
          <Text className={cn('text-xl font-bold mb-3', isDark ? 'text-white' : 'text-slate-900')}>
            Examples
          </Text>
          {doc.examples.map((example, index) => (
            <View key={index} className={cn('p-4 rounded-lg mb-4 bg-black')}>
              {example.title && (
                <Text className="text-slate-400 text-xs mb-2 uppercase font-bold tracking-wider">
                  {example.title}
                </Text>
              )}
              <Text className="text-green-400 font-mono text-sm">{example.code}</Text>
            </View>
          ))}
        </View>
      )}

      {doc.sourcePath && (
        <Text
          className={cn('text-xs opacity-50 mt-10', isDark ? 'text-slate-500' : 'text-slate-400')}>
          Source: {doc.sourcePath}
        </Text>
      )}
    </View>
  );
};

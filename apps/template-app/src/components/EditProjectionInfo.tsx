import React from 'react';

import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';
import { Text, View } from './Themed';

export default function EditProjectionInfo({ path }: { path: string }) {
  return (
    <View className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
      <View className="items-center">
        <Text className="text-base text-center font-medium text-slate-700 dark:text-slate-300">
          Open up the code for this Avatar-Relative Projection:
        </Text>

        <View className="rounded-md bg-slate-200 dark:bg-slate-800 px-3 py-2 my-4 shadow-inner">
          <MonoText>{path}</MonoText>
        </View>

        <Text className="text-sm text-center text-slate-500 dark:text-slate-400 mt-2 leading-5">
          Change any of the text, save the file, and your app will automatically update.
        </Text>
      </View>

      <View className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-5 items-center">
        <ExternalLink
          className="py-3 px-6 rounded-full bg-blue-50 dark:bg-blue-900/30 active:opacity-70 transition-opacity"
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet"
        >
          <Text className="text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
            Tap here if your app doesn&apos;t automatically update
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}

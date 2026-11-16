/**
 * @fileoverview OpenAI Assistant Avatar-Relative Projection
 * Provides a chat interface for users to interact with OpenAI's GPT-3.5-turbo model
 * via Supabase Edge Functions. Features professional UI with loading states and error handling.
 *
 * @author Your Name
 * @version 1.1.0
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  TextInput,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Clipboard,
} from 'react-native';
import { AlertManager as Alert } from '@/src/framework/ui/dialog/AlertManager';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';
import { useHaptics } from '../../framework/ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '../../framework/ui/haptics/IntelligentHaptics';
import { supabase } from '@/lib/supabase';
import { Tabs } from '@/src/components/AvatarRelativeProjection';
import { useSession } from '@/context/SessionProvider';
import { ProtectedRoute } from '@/src/route-law/ProtectedRoute';
import { Ionicons } from '@expo/vector-icons';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import { OfflineBanner } from '@/src/components/OfflineBanner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface CodeToken {
  text: string;
  type: 'plain' | 'comment' | 'string' | 'keyword' | 'type' | 'value';
}

export interface Segment {
  type: 'text' | 'code';
  language?: string;
  code?: string;
  content?: string;
}

/**
 * Parses markdown code blocks and segments
 */
export function parseMarkdown(text: string): Segment[] {
  const segments: Segment[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9+#-]*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const index = match.index;
    const language = match[1] || 'plaintext';
    const code = match[2];

    if (index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, index),
      });
    }

    segments.push({
      type: 'code',
      language,
      code,
    });

    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return segments;
}

/**
 * Formats inline code and bold styling
 */
const FormattedText = memo(function FormattedText({
  text,
  textColorClass,
}: {
  text: string;
  textColorClass: string;
}) {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(regex);

  return (
    <Text className={`text-base leading-6 ${textColorClass}`}>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          const codeVal = part.slice(1, -1);
          return (
            <Text
              key={i}
              className="bg-slate-200 dark:bg-slate-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono text-sm font-semibold"
            >
              {codeVal}
            </Text>
          );
        } else if (part.startsWith('**') && part.endsWith('**')) {
          const boldVal = part.slice(2, -2);
          return (
            <Text key={i} className="font-bold">
              {boldVal}
            </Text>
          );
        } else if (
          (part.startsWith('*') && part.endsWith('*')) ||
          (part.startsWith('_') && part.endsWith('_'))
        ) {
          const italicVal = part.slice(1, -1);
          return (
            <Text key={i} className="italic">
              {italicVal}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
});

/**
 * CodeBlock component with dark styling, language badge, copy button, and syntax highlighting
 */
const CodeBlock = memo(function CodeBlock({ code, language }: { code: string; language: string }) {
  const haptics = useHaptics();
  const tokens: CodeToken[] = [];

  // Basic Syntax highlighting regex
  const combinedRegex = new RegExp(
    '(' +
      '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*' + // comments
      ')|(' +
      '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`' + // strings
      ')|(\\b' +
      '(?:const|let|var|function|return|if|else|import|export|class|from|as|for|while|await|async|try|catch|finally|new|this|typeof|instanceof|extends|super|def|elif|in|is|not|and|or|except|with|lambda)' +
      '\\b)|(\\b' +
      '(?:string|number|boolean|any|void|unknown|never|object|Array|Promise|React|useState|useEffect|useRef|useMemo|useCallback|Response|Request|fetch|console|Deno)' +
      '\\b)|(\\b' +
      '(?:\\d+|true|false|null|undefined)' +
      '\\b)',
    'g'
  );

  let lastIndex = 0;
  let match;
  const trimmedCode = code.trim();

  while ((match = combinedRegex.exec(trimmedCode)) !== null) {
    const index = match.index;
    const text = match[0];

    if (index > lastIndex) {
      tokens.push({ text: trimmedCode.substring(lastIndex, index), type: 'plain' });
    }

    if (match[1]) {
      tokens.push({ text, type: 'comment' });
    } else if (match[2]) {
      tokens.push({ text, type: 'string' });
    } else if (match[3]) {
      tokens.push({ text, type: 'keyword' });
    } else if (match[4]) {
      tokens.push({ text, type: 'type' });
    } else if (match[5]) {
      tokens.push({ text, type: 'value' });
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < trimmedCode.length) {
    tokens.push({ text: trimmedCode.substring(lastIndex), type: 'plain' });
  }

  const copyToClipboard = async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(trimmedCode);
          haptics.trigger(HapticFeedbackPattern.SUCCESS);
          Alert.alert('Copied', 'Code copied to clipboard!');
        } else {
          console.warn('Clipboard API not available');
        }
        return;
      }
      Clipboard.setString(trimmedCode);
      haptics.trigger(HapticFeedbackPattern.SUCCESS);
      Alert.alert('Copied', 'Code copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const isIos = Platform.OS === 'ios';
  const monoFont = isIos ? 'Courier New' : 'monospace';

  return (
    <View className="my-2 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
      <View className="bg-slate-900 px-4 py-2 flex-row justify-between items-center border-b border-slate-800">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {language}
        </Text>
        <TouchableOpacity
          onPress={copyToClipboard}
          className="flex-row items-center bg-slate-800 px-2.5 py-1 rounded"
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Copy code to clipboard"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="copy-outline" size={12} color="#94A3B8" />
          <Text className="text-xs text-slate-300 ml-1">Copy</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} className="p-4 bg-slate-950">
        <Text style={{ fontFamily: monoFont }}>
          {tokens.map((token, i) => {
            let color = '#E2E8F0'; // plain text color
            let fontStyle: 'normal' | 'italic' = 'normal';

            switch (token.type) {
              case 'comment':
                color = '#64748B'; // slate-500
                fontStyle = 'italic';
                break;
              case 'string':
                color = '#34D399'; // emerald-400
                break;
              case 'keyword':
                color = '#F472B6'; // pink-400
                break;
              case 'type':
                color = '#60A5FA'; // blue-400
                break;
              case 'value':
                color = '#F59E0B'; // amber-500
                break;
            }

            return (
              <Text key={i} style={{ color, fontStyle }} className="text-sm">
                {token.text}
              </Text>
            );
          })}
        </Text>
      </ScrollView>
    </View>
  );
});

/**
 * Custom MarkdownRenderer to display assistant responses beautifully
 */
const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const segments = parseMarkdown(content);
  const textColorClass = isUser ? 'text-white' : 'text-slate-800';

  return (
    <View>
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return (
            <CodeBlock
              key={index}
              language={segment.language || 'plaintext'}
              code={segment.code || ''}
            />
          );
        } else {
          const textVal = segment.content || '';
          const lines = textVal.split('\n');
          return (
            <View key={index} className="space-y-1">
              {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                const isBullet = /^[•\-*]\s+/.test(trimmed);
                const numberedMatch = trimmed.match(/^(\d+)\.\s+/);

                if (isBullet) {
                  const bulletText = trimmed.replace(/^[•\-*]\s+/, '');
                  return (
                    <View key={lineIdx} className="flex-row items-start pl-2 py-0.5">
                      <Text className={`mr-2 text-base ${textColorClass}`}>•</Text>
                      <View className="flex-1">
                        <FormattedText text={bulletText} textColorClass={textColorClass} />
                      </View>
                    </View>
                  );
                }

                if (numberedMatch) {
                  const num = numberedMatch[1];
                  const bulletText = trimmed.substring(numberedMatch[0].length);
                  return (
                    <View key={lineIdx} className="flex-row items-start pl-2 py-0.5">
                      <Text className={`mr-1 text-base ${textColorClass}`}>{num}.</Text>
                      <View className="flex-1">
                        <FormattedText text={bulletText} textColorClass={textColorClass} />
                      </View>
                    </View>
                  );
                }

                if (trimmed === '') {
                  return <View key={lineIdx} className="h-2" />;
                }

                return (
                  <View key={lineIdx} className="py-0.5">
                    <FormattedText text={line} textColorClass={textColorClass} />
                  </View>
                );
              })}
            </View>
          );
        }
      })}
    </View>
  );
});

interface MessageItemProps {
  message: Message;
  userAvatarUrl?: string;
  userInitials: string;
}

/**
 * Chat bubble wrapper component
 */
const MessageItem = memo(function MessageItem({
  message,
  userAvatarUrl,
  userInitials,
}: MessageItemProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View className="flex-row items-end justify-end my-2 self-end max-w-[85%]">
        <View className="mr-2 flex-1 items-end">
          <View className="bg-indigo-600 rounded-2xl rounded-tr-none px-4 py-3 shadow-sm border border-indigo-500">
            <MarkdownRenderer content={message.content} isUser={true} />
          </View>
          <Text className="text-[10px] text-slate-400 mt-1 px-1">
            {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center border border-indigo-200 overflow-hidden shadow-sm">
          {userAvatarUrl ? (
            <Image source={{ uri: userAvatarUrl }} className="w-8 h-8" />
          ) : (
            <Text className="text-xs font-bold text-indigo-700 uppercase">{userInitials}</Text>
          )}
        </View>
      </View>
    );
  } else {
    return (
      <View className="flex-row items-end justify-start my-2 self-start max-w-[85%]">
        <View className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center border border-slate-300 mr-2 overflow-hidden shadow-sm">
          <Text className="text-base">🤖</Text>
        </View>
        <View className="flex-1">
          <View className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-slate-200">
            <MarkdownRenderer content={message.content} isUser={false} />
          </View>
          <Text className="text-[10px] text-slate-400 mt-1 px-1">
            {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }
});

/**
 * Pulsing skeleton loading indicator for assistant responses
 */
function TypingSkeleton() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const runPulse = (sharedVal: any, delay: number) => {
      sharedVal.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 600, easing: ReanimatedEasing.linear }),
            withTiming(0.3, { duration: 600, easing: ReanimatedEasing.linear })
          ),
          -1,
          false
        )
      );
    };
    runPulse(dot1, 0);
    runPulse(dot2, 200);
    runPulse(dot3, 400);
  }, []);

  const styleDot1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const styleDot2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const styleDot3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View className="flex-row items-end justify-start my-2 self-start max-w-[80%]">
      <View className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center border border-slate-300 mr-2 shadow-sm">
        <Text className="text-base">🤖</Text>
      </View>
      <View className="bg-slate-100 rounded-2xl rounded-tl-none p-4 border border-slate-200 shadow-sm flex-row items-center">
        <Animated.View
          style={styleDot1}
          className="w-2.5 h-2.5 rounded-full bg-slate-400"
        />
        <Animated.View
          style={styleDot2}
          className="w-2.5 h-2.5 rounded-full bg-slate-400 mx-1.5"
        />
        <Animated.View
          style={styleDot3}
          className="w-2.5 h-2.5 rounded-full bg-slate-400"
        />
      </View>
    </View>
  );
}

/**
 * Main OpenAI Avatar-Relative Projection Component
 */
export default function OpenAIAvatarRelativeProjection() {
  const { session } = useSession();
  const haptics = useHaptics();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const networkOnline = useActorOpsStore((state) => state.networkOnline);
  const [inputFocused, setInputFocused] = useState(false);

  const [userProfile, setUserProfile] = useState<{ avatarUrl: string; initials: string }>({
    avatarUrl: '',
    initials: 'AI',
  });

  const isMountedRef = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Initialize welcome message once on mount
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hello! I am your AI assistant. How can I help you today? \n\nTry asking me a question or paste code here! **Example:**\n```typescript\nconst greet = () => {\n  console.log('Hello truex app!');\n};\n```",
        createdAt: new Date(),
      },
    ]);
  }, []);

  // Load user profile details for avatar pictures
  useEffect(() => {
    async function loadUserProfile() {
      try {
        if (!session?.user) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (!isMountedRef.current) return;

        if (error) {
          console.warn('Error fetching avatar profile details:', error.message);
        }

        const email = session.user.email || '';
        const username = data?.username || '';
        let initials = 'ME';

        if (username) {
          initials = username.substring(0, 2).toUpperCase();
        } else if (email) {
          initials = email.substring(0, 2).toUpperCase();
        }

        if (isMountedRef.current) {
          setUserProfile({
            avatarUrl: data?.avatar_url || '',
            initials,
          });
        }
      } catch (err) {
        console.warn('Could not fetch user avatar profile details:', err);
      }
    }

    if (session) {
      loadUserProfile();
    }
  }, [session?.user?.id]);

  const scrollToBottom = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 100) as any;
  }, []);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const paddingToBottom = 150;
    const isCloseToBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y <= paddingToBottom;

    const targetState = !isCloseToBottom && contentSize.height > layoutMeasurement.height;
    setShowScrollBottomBtn((prev) => (prev !== targetState ? targetState : prev));
  }, []);

  const callOpenAIFunction = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Please enter a prompt');
      return;
    }

    const currentPrompt = prompt.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentPrompt,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);
    scrollToBottom();

    const aiMsgId = (Date.now() + 1).toString();
    let accumulatedContent = '';
    let assistantMsgAdded = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use native fetch for streaming
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/openai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ message: currentPrompt, stream: true }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data: ')) continue;
          
          const data = trimmedLine.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || parsed.message || '';
            
            if (content) {
              if (!assistantMsgAdded) {
                if (isMountedRef.current) {
                  setLoading(false);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: aiMsgId,
                      role: 'assistant',
                      content: '',
                      createdAt: new Date(),
                    },
                  ]);
                }
                assistantMsgAdded = true;
              }
              
              accumulatedContent += content;
              if (isMountedRef.current) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMsgId ? { ...msg, content: accumulatedContent } : msg
                  )
                );
                scrollToBottom();
              }
            }
          } catch (e) {
            // Fallback for non-JSON stream data
            if (data) {
              if (!assistantMsgAdded) {
                if (isMountedRef.current) {
                  setLoading(false);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: aiMsgId,
                      role: 'assistant',
                      content: '',
                      createdAt: new Date(),
                    },
                  ]);
                }
                assistantMsgAdded = true;
              }
              accumulatedContent += data;
              if (isMountedRef.current) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMsgId ? { ...msg, content: accumulatedContent } : msg
                  )
                );
                scrollToBottom();
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      const errorContent = `❌ Sorry, I encountered an error: ${err.message || 'Failed to get AI response'}`;
      
      if (!assistantMsgAdded) {
        const errorMsg: Message = {
          id: aiMsgId,
          role: 'assistant',
          content: errorContent,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, content: accumulatedContent + '\n\n' + errorContent } : msg
          )
        );
      }
      
      Alert.alert('Error', err.message || 'A network error occurred');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        scrollToBottom();
      }
    }
  }, [prompt, scrollToBottom]);

  const clearChat = useCallback(() => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear conversation history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          haptics.trigger(HapticFeedbackPattern.HEAVY);
          if (isMountedRef.current) {
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content:
                  "Hello! I am your AI assistant. How can I help you today? \n\nTry asking me a question or paste code here! **Example:**\n```typescript\nconst greet = () => {\n  console.log('Hello truex app!');\n};\n```",
                createdAt: new Date(),
              },
            ]);
          }
        },
      },
    ]);
  }, []);

  return (
    <ProtectedRoute route={{ requiredIdentityBoundary: 'verified', requiredReceiptCommandId: 'cmd_openai_access' }}>
      <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1 bg-slate-50"
      style={{ maxWidth: 800, alignSelf: 'center', width: '100%' }}
    >
      <Tabs.Screen options={{ title: 'AI Assistant' }} />
      <OfflineBanner />

      {/* Header Info */}
      <View className="bg-white px-4 py-3 border-b border-slate-200 flex-row justify-between items-center shadow-sm">
        <View className="flex-row items-center">
          <View
            className={`w-2.5 h-2.5 ${networkOnline ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full mr-2`}
          />
          <View>
            <Text className="font-bold text-slate-800 text-sm">GPT Assistant</Text>
            <Text className="text-[10px] text-slate-500">
              {networkOnline ? 'Always active & ready to help' : 'Offline Mode'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={clearChat}
          className="flex-row items-center px-2 py-1 rounded bg-slate-100 border border-slate-200"
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Clear chat history"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="trash-outline" size={14} color="#64748B" />
          <Text className="text-xs text-slate-600 ml-1 font-medium">Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Message List */}
      <View className="flex-1 relative">
        <ScrollView
          testID="message-scrollview"
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}
          onContentSizeChange={scrollToBottom}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((item) => (
            <MessageItem
              key={item.id}
              message={item}
              userAvatarUrl={userProfile.avatarUrl}
              userInitials={userProfile.initials}
            />
          ))}

          {loading && <TypingSkeleton />}
        </ScrollView>

        {/* Scroll to Bottom Button */}
        {showScrollBottomBtn && (
          <TouchableOpacity
            testID="scroll-bottom-button"
            onPress={scrollToBottom}
            className="absolute bottom-4 right-4 bg-indigo-600 w-11 h-11 rounded-full items-center justify-center shadow-lg border border-indigo-500"
            activeOpacity={0.8}
            style={{ zIndex: 10 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Scroll to bottom"
          >
            <Ionicons name="arrow-down" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Offline Alert Banner */}
      {!networkOnline && (
        <View
          testID="openai-offline-state"
          className="bg-amber-50 border-t border-b border-amber-200 p-3 flex-row items-center justify-center"
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#D97706"
            style={{ marginRight: 6 }}
          />
          <Text className="text-amber-800 text-xs font-bold text-center">
            AI Assistant is offline. Please check your network connection.
          </Text>
        </View>
      )}

      {/* Input Tray */}
      <View className="p-3 bg-white border-t border-slate-200">
        <View className={`flex-row items-end bg-slate-50 border rounded-2xl p-1.5 pl-3.5 pr-1.5 shadow-sm transition-all duration-200 ${
          inputFocused ? 'border-indigo-600 bg-white ring-2 ring-indigo-100' : 'border-slate-200'
        }`}>
          <TextInput
            className="flex-1 text-slate-800 text-base py-1.5 max-h-24 bg-transparent"
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={networkOnline ? 'Ask AI anything...' : 'AI Assistant is offline...'}
            placeholderTextColor="#475569"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            textAlignVertical="center"
            editable={networkOnline && !loading}
            accessibilityLabel="AI Prompt Input"
            accessibilityHint="Type your question for the AI assistant"
          />
          <TouchableOpacity
            testID="send-button"
            className={`rounded-xl p-2.5 items-center justify-center ${
              loading || !prompt.trim() || !networkOnline
                ? 'bg-slate-100'
                : 'bg-indigo-600 shadow-sm'
            }`}
            onPress={callOpenAIFunction}
            disabled={loading || !prompt.trim() || !networkOnline}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: loading || !prompt.trim() || !networkOnline }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={loading ? 'ellipsis-horizontal' : 'send'}
              size={16}
              color={loading || !prompt.trim() || !networkOnline ? '#94A3B8' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </ProtectedRoute>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

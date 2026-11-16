/**
 * @fileoverview FastTFLiteAdapter implementing LLMAdapter.
 * Simulates a local TFLite / ONNX runtime adapter running a static vocabulary subword tokenizer (BPE)
 * and intent classification layer under local device constraints.
 */

import { InferenceRequest, InferenceUsage, LLMAdapter } from './LocalInferenceEngine';

export const VOCAB: Record<string, number> = {
  '<pad>': 0,
  '<unk>': 1,
  '<s>': 2,
  '</s>': 3,
  'hello': 4,
  'hi': 5,
  'process': 6,
  'conformance': 7,
  'alignment': 8,
  'profile': 9,
  'account': 10,
  'sync': 11,
  'energy': 12,
  'battery': 13,
  'power': 14,
};

/**
 * Greedy BPE-style subword / word tokenizer.
 */
export function tokenize(text: string): number[] {
  const words = text.toLowerCase().split(/[\s,.\-!?]+/);
  const tokens: number[] = [];

  for (const word of words) {
    if (!word) continue;
    let remaining = word;
    while (remaining.length > 0) {
      let matched = false;
      for (let len = remaining.length; len > 0; len--) {
        const sub = remaining.substring(0, len);
        if (sub in VOCAB) {
          tokens.push(VOCAB[sub]);
          remaining = remaining.substring(len);
          matched = true;
          break;
        }
      }
      if (!matched) {
        tokens.push(VOCAB['<unk>']);
        remaining = remaining.substring(1);
      }
    }
  }

  return tokens;
}

/**
 * Normalizes tokens into float input tensors [0.0 - 1.0].
 */
export function getFloatInputs(tokens: number[]): number[] {
  const maxVal = Math.max(...Object.values(VOCAB));
  return tokens.map((t) => t / maxVal);
}

/**
 * Classifies the intent using linear neural layer weights mapping.
 */
export function classifyIntents(floatInputs: number[]): string {
  const weights: Record<string, number[]> = {
    greeting: [0.0, 0.0, 0.0, 0.0, 0.9, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    process:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.9, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    profile:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.9, 0.0, 0.0, 0.0, 0.0],
    sync:     [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.9, 0.9, 0.9],
  };

  const scores: Record<string, number> = {
    greeting: 0,
    process: 0,
    profile: 0,
    sync: 0,
  };

  const vocabKeys = Object.keys(VOCAB);

  for (const f of floatInputs) {
    const vocabIndex = Math.round(f * (vocabKeys.length - 1));
    for (const intent in weights) {
      scores[intent] += weights[intent][vocabIndex] || 0;
    }
  }

  let bestIntent = 'general';
  let maxScore = 0.2; // classification threshold

  for (const intent in scores) {
    if (scores[intent] > maxScore) {
      maxScore = scores[intent];
      bestIntent = intent;
    }
  }

  return bestIntent;
}

const RESPONSES: Record<string, string> = {
  greeting: 'Hello from Edge-AI local inference engine! Your intent was identified as greeting.',
  process: 'Local Process Conformance Analysis complete. The system verified your petri-net trace against standard compliance metrics.',
  profile: 'Local profile details retrieved. Sync admission gate is active to persist modifications first-class.',
  sync: 'Energy sync policy analysis complete. Network sync rate was evaluated and deferred under battery policy check.',
  general: 'Edge-AI local inference engine completed executing your request under device constraint parameters.',
};

export class FastTFLiteAdapter implements LLMAdapter {
  readonly modelId: string;

  constructor(modelId = 'tflite-distilbert-intent') {
    this.modelId = modelId;
  }

  private _generateResponse(prompt: string): { text: string; tokensCount: number } {
    const tokens = tokenize(prompt);
    const floatInputs = getFloatInputs(tokens);
    const intent = classifyIntents(floatInputs);
    const responseText = RESPONSES[intent] || RESPONSES.general;

    return {
      text: responseText,
      tokensCount: tokens.length,
    };
  }

  async run(request: InferenceRequest): Promise<{ text: string; usage: InferenceUsage }> {
    // Represent lightweight local compute delay
    await new Promise((resolve) => setTimeout(resolve, 80));

    const { text, tokensCount } = this._generateResponse(request.prompt);
    const responseTokens = tokenize(text).length;

    return {
      text,
      usage: {
        promptTokens: tokensCount,
        completionTokens: responseTokens,
        totalTokens: tokensCount + responseTokens,
      },
    };
  }

  async stream(
    request: InferenceRequest,
    onToken: (token: string) => void
  ): Promise<{ text: string; usage: InferenceUsage }> {
    const { text, tokensCount } = this._generateResponse(request.prompt);
    const words = text.split(/(\s+)/);

    let assembled = '';
    for (const word of words) {
      if (word) {
        await new Promise((resolve) => setTimeout(resolve, 8));
        assembled += word;
        onToken(word);
      }
    }

    const responseTokens = tokenize(assembled).length;

    return {
      text: assembled,
      usage: {
        promptTokens: tokensCount,
        completionTokens: responseTokens,
        totalTokens: tokensCount + responseTokens,
      },
    };
  }
}

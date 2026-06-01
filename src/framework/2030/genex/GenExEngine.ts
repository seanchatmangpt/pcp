import { ILocalInferenceEngine } from '../../ai/on-device/types';
import { GenExVariant, GenExAesthetic } from './types';

export class GenExEngine {
  constructor(private inferenceEngine: ILocalInferenceEngine) {}

  /**
   * Generates a new UI variant based on the user's trust score and navigation history.
   */
  async generateVariant(trustScore: number, navHistory: string[]): Promise<GenExVariant> {
    const prompt = this.buildPrompt(trustScore, navHistory);

    const result = await this.inferenceEngine.infer({
      prompt,
      modelId: 'genex-v1-visionary',
    });

    return this.parseResponse(result.text, trustScore);
  }

  private buildPrompt(trustScore: number, navHistory: string[]): string {
    return `
      System: You are the Pcp Framework GenEx Engine.
      User Trust Score: ${trustScore.toFixed(2)}
      Navigation History: ${navHistory.join(' -> ')}
      
      Task: Generate a UI variant configuration in JSON format.
      High trust scores ( > 0.8) should result in "expansive" and "relaxed" layouts with vibrant colors.
      Low trust scores ( < 0.4) should result in "focused" and "compact" layouts with high-contrast, security-oriented colors (e.g., deep blues, grays).
      
      Response format:
      {
        "name": "Variant Name",
        "aesthetic": {
          "primaryColor": "#HEX",
          "backgroundColor": "#HEX",
          "spacingScale": 1.0,
          "borderRadius": 8
        },
        "layoutType": "compact|relaxed|focused|expansive"
      }
    `;
  }

  private parseResponse(responseText: string, trustScore: number): GenExVariant {
    try {
      // Find JSON block if it's wrapped in text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      const parsed = JSON.parse(jsonStr);

      return {
        id: `genex-${Date.now()}`,
        name: parsed.name || 'Generated Variant',
        aesthetic: parsed.aesthetic || this.getDefaultAesthetic(trustScore),
        layoutType: parsed.layoutType || this.getDefaultLayout(trustScore),
      };
    } catch (e) {
      // Fallback to heuristic-based generation if LLM fails or returns garbage
      return this.generateHeuristicVariant(trustScore);
    }
  }

  private generateHeuristicVariant(trustScore: number): GenExVariant {
    return {
      id: `genex-h-${Date.now()}`,
      name: trustScore > 0.7 ? 'Expansive Flow' : 'Secure Focus',
      aesthetic: this.getDefaultAesthetic(trustScore),
      layoutType: this.getDefaultLayout(trustScore),
    };
  }

  private getDefaultAesthetic(trustScore: number): GenExAesthetic {
    if (trustScore > 0.7) {
      return {
        primaryColor: '#6366f1', // Indigo
        backgroundColor: '#ffffff',
        spacingScale: 1.2,
        borderRadius: 16,
      };
    } else if (trustScore < 0.4) {
      return {
        primaryColor: '#1e293b', // Slate 800
        backgroundColor: '#f8fafc',
        spacingScale: 0.8,
        borderRadius: 4,
      };
    } else {
      return {
        primaryColor: '#3b82f6', // Blue 500
        backgroundColor: '#ffffff',
        spacingScale: 1.0,
        borderRadius: 8,
      };
    }
  }

  private getDefaultLayout(trustScore: number): 'compact' | 'relaxed' | 'focused' | 'expansive' {
    if (trustScore > 0.8) return 'expansive';
    if (trustScore > 0.5) return 'relaxed';
    if (trustScore < 0.3) return 'focused';
    return 'compact';
  }
}

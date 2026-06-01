export interface OmniAccessibility {
  label?: string;
  hint?: string;
  audioCue?: string;
  audioPitch?: number; // Spatial pitch
  audioPan?: number; // Spatial panning (-1 to 1)
  hapticPattern?: string; // e.g. 'success', 'warning', 'error', 'braille-A'
  hapticIntensity?: number; // 0 to 1
}

export interface GenerativeView {
  id: string;
  type: 'container' | 'text' | 'button' | 'image' | 'list' | 'input';
  props?: Record<string, any>;
  children?: GenerativeView[];
  accessibility?: OmniAccessibility;
}

export interface VisualOutput {
  id: string;
  elementType: string;
  properties: Record<string, any>;
  children: VisualOutput[];
}

export interface AudioOutputNode {
  id: string;
  cue: string;
  pitch: number;
  pan: number;
}

export interface HapticOutputNode {
  id: string;
  pattern: string;
  intensity: number;
}

export interface CompiledOutput {
  visual: VisualOutput;
  audio: AudioOutputNode[];
  haptic: HapticOutputNode[];
}

export class OmniCompiler {
  /**
   * Compiles a single GenerativeView schema into Omni-Modal outputs:
   * Visual, Audio (spatial soundscapes), and Haptic (braille-like vibrations).
   */
  static compile(schema: GenerativeView): CompiledOutput {
    if (!schema) {
      throw new Error('Invalid schema: Schema cannot be null or undefined');
    }

    return {
      visual: this.compileVisual(schema),
      audio: this.compileAudio(schema),
      haptic: this.compileHaptic(schema),
    };
  }

  private static compileVisual(node: GenerativeView): VisualOutput {
    return {
      id: node.id,
      elementType: node.type,
      properties: node.props ? { ...node.props } : {},
      children: Array.isArray(node.children)
        ? node.children.map((child) => this.compileVisual(child))
        : [],
    };
  }

  private static compileAudio(node: GenerativeView): AudioOutputNode[] {
    const audioNodes: AudioOutputNode[] = [];

    if (node.accessibility?.audioCue) {
      audioNodes.push({
        id: node.id,
        cue: node.accessibility.audioCue,
        pitch: node.accessibility.audioPitch ?? 1.0,
        pan: node.accessibility.audioPan ?? 0.0,
      });
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        audioNodes.push(...this.compileAudio(child));
      }
    }

    return audioNodes;
  }

  private static compileHaptic(node: GenerativeView): HapticOutputNode[] {
    const hapticNodes: HapticOutputNode[] = [];

    if (node.accessibility?.hapticPattern) {
      hapticNodes.push({
        id: node.id,
        pattern: node.accessibility.hapticPattern,
        intensity: node.accessibility.hapticIntensity ?? 1.0,
      });
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        hapticNodes.push(...this.compileHaptic(child));
      }
    }

    return hapticNodes;
  }
}

import { renderHook, act } from '@testing-library/react-native';
import { OmniCompiler, GenerativeView } from '../OmniCompiler';
import { useOmniModal } from '../useOmniModal';

describe('OmniCompiler', () => {
  it('throws an error if schema is null or undefined', () => {
    expect(() => OmniCompiler.compile(null as any)).toThrow(
      'Invalid schema: Schema cannot be null or undefined'
    );
    expect(() => OmniCompiler.compile(undefined as any)).toThrow(
      'Invalid schema: Schema cannot be null or undefined'
    );
  });

  it('compiles a simple schema with visual, audio, and haptic outputs', () => {
    const schema: GenerativeView = {
      id: 'root-1',
      type: 'container',
      props: { style: 'flex' },
      accessibility: {
        audioCue: 'whoosh',
        audioPitch: 1.2,
        audioPan: -0.5,
        hapticPattern: 'success',
        hapticIntensity: 0.8,
      },
    };

    const output = OmniCompiler.compile(schema);

    expect(output.visual).toEqual({
      id: 'root-1',
      elementType: 'container',
      properties: { style: 'flex' },
      children: [],
    });

    expect(output.audio).toHaveLength(1);
    expect(output.audio[0]).toEqual({
      id: 'root-1',
      cue: 'whoosh',
      pitch: 1.2,
      pan: -0.5,
    });

    expect(output.haptic).toHaveLength(1);
    expect(output.haptic[0]).toEqual({
      id: 'root-1',
      pattern: 'success',
      intensity: 0.8,
    });
  });

  it('compiles a nested schema correctly falling back to defaults for audio/haptic', () => {
    const schema: GenerativeView = {
      id: 'root-1',
      type: 'container',
      children: [
        {
          id: 'child-1',
          type: 'text',
          accessibility: {
            audioCue: 'pop',
            hapticPattern: 'tap',
          },
        },
        {
          id: 'child-2',
          type: 'button',
          props: { onPress: 'action' },
        },
      ],
    };

    const output = OmniCompiler.compile(schema);

    expect(output.visual.children).toHaveLength(2);
    expect(output.visual.children[1].properties).toEqual({ onPress: 'action' });

    expect(output.audio).toHaveLength(1);
    expect(output.audio[0]).toEqual({
      id: 'child-1',
      cue: 'pop',
      pitch: 1.0, // default
      pan: 0.0, // default
    });

    expect(output.haptic).toHaveLength(1);
    expect(output.haptic[0]).toEqual({
      id: 'child-1',
      pattern: 'tap',
      intensity: 1.0, // default
    });
  });

  it('compiles children with no arrays gracefully', () => {
    const schema: GenerativeView = {
      id: 'root-1',
      type: 'container',
      children: undefined,
    };

    const output = OmniCompiler.compile(schema);
    expect(output.visual.children).toEqual([]);
    expect(output.audio).toEqual([]);
    expect(output.haptic).toEqual([]);
  });
});

describe('useOmniModal', () => {
  const initialSchema: GenerativeView = {
    id: 'root-1',
    type: 'container',
  };

  it('initializes with the correct schema and compiled output', () => {
    const { result } = renderHook(() => useOmniModal(initialSchema));

    expect(result.current.schema).toEqual(initialSchema);
    expect(result.current.compiledOutput.visual.id).toBe('root-1');
  });

  it('updates schema and re-compiles correctly', () => {
    const { result } = renderHook(() => useOmniModal(initialSchema));

    const newSchema: GenerativeView = {
      id: 'root-2',
      type: 'button',
      accessibility: {
        hapticPattern: 'vibrate',
      },
    };

    act(() => {
      result.current.updateSchema(newSchema);
    });

    expect(result.current.schema).toEqual(newSchema);
    expect(result.current.compiledOutput.visual.id).toBe('root-2');
    expect(result.current.compiledOutput.haptic).toHaveLength(1);
  });

  it('updates schema via callback and re-compiles correctly', () => {
    const { result } = renderHook(() => useOmniModal(initialSchema));

    act(() => {
      result.current.updateSchema((prev) => ({
        ...prev,
        type: 'text',
        id: 'root-text',
      }));
    });

    expect(result.current.schema.type).toBe('text');
    expect(result.current.schema.id).toBe('root-text');
    expect(result.current.compiledOutput.visual.elementType).toBe('text');
  });

  it('resets schema correctly', () => {
    const { result } = renderHook(() => useOmniModal(initialSchema));

    act(() => {
      result.current.updateSchema({
        id: 'root-3',
        type: 'image',
      });
    });

    expect(result.current.schema.id).toBe('root-3');

    act(() => {
      result.current.resetSchema();
    });

    expect(result.current.schema).toEqual(initialSchema);
  });

  it('throws error in memo when schema is invalid', () => {
    // Suppress console.error for expected throws in React render
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useOmniModal(initialSchema));

    expect(() => {
      act(() => {
        result.current.updateSchema(null as any);
      });
    }).toThrow('Invalid schema: Schema cannot be null or undefined');

    consoleError.mockRestore();
  });
});

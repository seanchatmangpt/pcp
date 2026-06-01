/**
 * @fileoverview Tests for Semantic Translation 2.0 Engine.
 */

import { SemanticTranslationEngine } from './SemanticTranslationEngine';

// Mock require for JSON data if necessary,
// but here we can probably rely on the real files if jest is configured correctly.

describe('SemanticTranslationEngine', () => {
  let engine: SemanticTranslationEngine;

  beforeEach(() => {
    engine = new SemanticTranslationEngine('en-US');
  });

  it('should initialize with en-US data', async () => {
    await engine.initialize();
    expect(engine.getCulture()).toBe('en-US');
    expect(engine.getOrientation()).toBe('ltr');
  });

  it('should translate a simple key', async () => {
    await engine.initialize();
    const intent = engine.translate('auth.login');
    expect(intent.text).toBe('Log In');
    expect(intent.icon).toBe('login');
    expect(intent.layout).toBe('ltr');
  });

  it('should interpolate variables', async () => {
    await engine.initialize();
    const intent = engine.translate('welcome.message', { name: 'Pcp' });
    expect(intent.text).toBe('Welcome back, Pcp!');
  });

  it('should switch culture to ar-SA and change orientation', async () => {
    await engine.initialize();
    await engine.setCulture('ar-SA');
    expect(engine.getCulture()).toBe('ar-SA');
    expect(engine.getOrientation()).toBe('rtl');

    const intent = engine.translate('auth.login');
    expect(intent.text).toBe('تسجيل الدخول');
    expect(intent.layout).toBe('rtl');
  });

  it('should return default intent for unknown keys', async () => {
    await engine.initialize();
    const intent = engine.translate('unknown.key');
    expect(intent.intent).toBe('unknown');
    expect(intent.text).toBe('unknown.key');
  });

  it('should throw if not initialized', () => {
    expect(() => engine.translate('auth.login')).toThrow('[SemanticI18n] Engine not initialized');
  });

  it('should handle aesthetic configuration', async () => {
    await engine.initialize();
    const aesthetic = engine.getAesthetic();
    expect(aesthetic.spacingMultiplier).toBe(1.0);

    await engine.setCulture('ar-SA');
    const arAesthetic = engine.getAesthetic();
    expect(arAesthetic.spacingMultiplier).toBe(1.2);
  });
});

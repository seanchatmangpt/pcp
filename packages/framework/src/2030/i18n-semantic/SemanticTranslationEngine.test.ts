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
});

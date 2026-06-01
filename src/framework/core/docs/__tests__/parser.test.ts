import { parseJSDoc } from '../parser';

describe('parseJSDoc', () => {
  it('should parse basic JSDoc', () => {
    const jsDoc = `
      /**
       * @name useTest
       * @description A test hook.
       * @type hook
       */
    `;
    const result = parseJSDoc(jsDoc);
    expect(result.name).toBe('useTest');
    expect(result.description).toBe('A test hook.');
    expect(result.type).toBe('hook');
  });

  it('should parse JSDoc with params and returns', () => {
    const jsDoc = `
      /**
       * @name calculate
       * @description Performs a calculation.
       * @type utility
       * @param {number} a - First number
       * @param {number} b - Second number
       * @returns {number} The sum
       */
    `;
    const result = parseJSDoc(jsDoc);
    expect(result.params).toHaveLength(2);
    expect(result.params?.[0]).toEqual({
      type: 'number',
      name: 'a',
      description: 'First number',
    });
    expect(result.returns).toEqual({
      type: 'number',
      description: 'The sum',
    });
  });

  it('should parse JSDoc with examples', () => {
    const jsDoc = `
      /**
       * @name MyComponent
       * @example
       * <MyComponent />
       * @example
       * <MyComponent prop="value" />
       */
    `;
    const result = parseJSDoc(jsDoc);
    expect(result.examples).toHaveLength(2);
    expect(result.examples?.[0].code).toBe('<MyComponent />');
    expect(result.examples?.[1].code).toBe('<MyComponent prop="value" />');
  });

  it('should fallback to first block as description', () => {
    const jsDoc = `
      /**
       * This is a standalone description.
       * @name standalone
       */
    `;
    const result = parseJSDoc(jsDoc);
    expect(result.description).toBe('This is a standalone description.');
  });

  it('should handle empty or malformed JSDoc', () => {
    const result = parseJSDoc('/** */');
    expect(result.params).toHaveLength(0);
    expect(result.examples).toHaveLength(0);
  });

  it('should parse @id', () => {
    const jsDoc = '/** @id my-custom-id */';
    const result = parseJSDoc(jsDoc);
    expect(result.id).toBe('my-custom-id');
  });
});

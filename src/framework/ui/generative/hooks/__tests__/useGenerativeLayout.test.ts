import { renderHook } from '@testing-library/react-native';
import { useGenerativeLayout } from '../useGenerativeLayout';
import { GenerativeSchema } from '../../types';

describe('useGenerativeLayout', () => {
  const mockSchema: GenerativeSchema = {
    title: 'Test Profile',
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'bio', label: 'Biography', type: 'string' },
      { key: 'avatar', label: 'Avatar', type: 'string', format: 'image' },
      { key: 'website', label: 'Website', type: 'uri' },
    ],
    layoutHints: {
      avatar: { position: 'header', priority: 1, variant: 'hero' },
      name: { position: 'header', priority: 2, variant: 'flat' },
      bio: { position: 'body', priority: 1, variant: 'flat' },
      website: { position: 'footer', priority: 1, variant: 'compact' },
    },
  };

  const mockData = {
    name: 'Jane Doe',
    bio: 'Software engineer and designer.',
    avatar: 'https://example.com/avatar.jpg',
    website: 'https://janedoe.com',
  };

  it('should correctly group fields by position', () => {
    const { result } = renderHook(() => useGenerativeLayout(mockSchema, mockData));

    expect(result.current.header).toHaveLength(2);
    expect(result.current.body).toHaveLength(1);
    expect(result.current.footer).toHaveLength(1);
  });

  it('should sort fields by priority', () => {
    const { result } = renderHook(() => useGenerativeLayout(mockSchema, mockData));

    expect(result.current.header[0].key).toBe('avatar');
    expect(result.current.header[1].key).toBe('name');
  });

  it('should use default hints if not provided', () => {
    const minimalSchema: GenerativeSchema = {
      fields: [{ key: 'only', type: 'string' }],
    };
    const { result } = renderHook(() => useGenerativeLayout(minimalSchema, { only: 'value' }));

    expect(result.current.body).toHaveLength(1);
    expect(result.current.body[0].hint.position).toBe('body');
  });
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DocExplorer } from '../DocExplorer';
import { docRegistry } from '../DocRegistry';
import { useTheme } from '../../../ui/theme/useTheme';

// Mock useTheme
jest.mock('../../../ui/theme/useTheme', () => ({
  useTheme: jest.fn(),
}));

// Mock nativewind / tailwind-merge if necessary, but usually they work in tests if configured
// For now let's assume standard render works

describe('DocExplorer', () => {
  beforeEach(() => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: { mode: 'light' },
    });
    docRegistry.clear();
    docRegistry.registerMetadata({
      id: 'test-hook',
      name: 'useTest',
      description: 'A test hook',
      type: 'hook',
      params: [{ name: 'param1', type: 'string', description: 'desc1' }],
      examples: [{ code: 'useTest()' }],
    });
  });

  it('renders correctly in dark mode', () => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: { mode: 'dark' },
    });
    const { getByText } = render(<DocExplorer />);
    expect(getByText('Framework API Explorer')).toBeTruthy();
  });

  it('filters results based on search in description', () => {
    docRegistry.registerMetadata({
      id: 'desc-match',
      name: 'UniqueName',
      description: 'FindMeInDescription',
      type: 'utility',
    });
    const { getByPlaceholderText, getByText } = render(<DocExplorer />);

    const input = getByPlaceholderText('Search hooks, components, utilities...');
    fireEvent.changeText(input, 'FindMe');

    expect(getByText('UniqueName')).toBeTruthy();
  });

  it('filters results based on search in type', () => {
    docRegistry.registerMetadata({
      id: 'type-match',
      name: 'SpecialTypeItem',
      description: 'desc',
      type: 'hook',
    });
    const { getByPlaceholderText, getByText } = render(<DocExplorer />);

    const input = getByPlaceholderText('Search hooks, components, utilities...');
    fireEvent.changeText(input, 'hook');

    expect(getByText('SpecialTypeItem')).toBeTruthy();
  });

  it('displays details with returns and sourcePath', () => {
    docRegistry.registerMetadata({
      id: 'full-doc',
      name: 'FullDoc',
      description: 'desc',
      type: 'utility',
      returns: { type: 'void', description: 'nothing' },
      sourcePath: 'src/full.ts',
      examples: [{ title: 'Example 1', code: 'code1' }],
    });
    const { getByText } = render(<DocExplorer />);

    fireEvent.press(getByText('FullDoc'));

    expect(getByText('Returns')).toBeTruthy();
    expect(getByText('void')).toBeTruthy();
    expect(getByText('nothing')).toBeTruthy();
    expect(getByText('Source: src/full.ts')).toBeTruthy();
    expect(getByText('Example 1')).toBeTruthy();
    expect(getByText('code1')).toBeTruthy();
  });
});

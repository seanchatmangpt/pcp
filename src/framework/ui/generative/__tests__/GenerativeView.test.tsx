import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GenerativeView } from '../GenerativeView';
import { GenerativeSchema } from '../types';

// Mock useTheme
jest.mock('../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      text: '#000000',
      card: '#F2F2F7',
      border: '#C6C6C8',
    },
    fontScale: 1,
  }),
}));

describe('GenerativeView', () => {
  const mockSchema: GenerativeSchema = {
    title: 'Profile',
    fields: [
      { key: 'username', label: 'Username', type: 'string' },
      { key: 'isAdmin', label: 'Admin Status', type: 'boolean' },
      { key: 'profilePic', label: 'Photo', type: 'string', format: 'image' },
    ],
  };

  const mockData = {
    username: 'johndoe',
    isAdmin: true,
    profilePic: 'https://example.com/pic.png',
  };

  it('renders correctly with schema and data', () => {
    const { getByText } = render(<GenerativeView schema={mockSchema} data={mockData} />);

    expect(getByText('Profile')).toBeTruthy();
    expect(getByText('Username')).toBeTruthy();
    expect(getByText('johndoe')).toBeTruthy();
    expect(getByText('Admin Status')).toBeTruthy();
    expect(getByText('Yes')).toBeTruthy();
  });

  it('calls onAction when a field is pressed', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <GenerativeView schema={mockSchema} data={mockData} onAction={onAction} />
    );

    fireEvent.press(getByText('johndoe'));
    expect(onAction).toHaveBeenCalledWith('username', 'johndoe');
  });

  it('renders descriptions if provided', () => {
    const schemaWithDesc: GenerativeSchema = {
      fields: [
        { key: 'test', label: 'Test', type: 'string', description: 'This is a description' },
      ],
    };
    const { getByText } = render(<GenerativeView schema={schemaWithDesc} data={{ test: 'val' }} />);

    expect(getByText('This is a description')).toBeTruthy();
  });
});

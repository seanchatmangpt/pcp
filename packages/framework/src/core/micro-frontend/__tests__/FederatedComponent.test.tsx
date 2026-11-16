import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { FederatedComponent } from '../FederatedComponent';
import { Text } from 'react-native';

describe('FederatedComponent', () => {
  const mockConfig = {
    name: 'testRemote',
    url: 'https://example.com/remoteEntry.js',
    scope: 'testScope',
    module: './testModule',
  };

  it('renders fallback while loading', async () => {
    render(<FederatedComponent {...mockConfig} fallback={<Text>Loading...</Text>} />);

    expect(screen.getByText('Loading...')).toBeDefined();

    // Wait for it to finish loading so the test doesn't have pending effects
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull(), { timeout: 2000 });
  });

  it('renders error component on failure', async () => {
    render(
      <FederatedComponent
        {...mockConfig}
        url="" // Trigger error
        errorComponent={(err) => <Text>Error: {err.message}</Text>}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('Error: No URL provided for federated module')).toBeDefined()
    );
  });

  it('renders the federated component when ready', async () => {
    const { getByTestId, getByText } = render(
      <FederatedComponent {...mockConfig} props={{ title: 'Hello from Remote' }} />
    );

    await waitFor(() => expect(getByTestId('federated-stub')).toBeDefined(), { timeout: 2000 });
    expect(getByText('Federated Module: testRemote')).toBeDefined();
    expect(getByText('Module: ./testModule')).toBeDefined();
  });
});

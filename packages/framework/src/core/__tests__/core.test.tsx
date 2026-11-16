import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react-native';
import { Text, View, Pressable } from 'react-native';

import { ErrorBoundary } from '../ErrorBoundary';
import { MembraneProvider, useMembrane } from '../MembraneProvider';
import { PcpFrameworkProvider } from '../PcpFrameworkProvider';

import { docRegistry } from '../docs/DocRegistry';
import { DocExplorer } from '../docs/DocExplorer';
import { parseJSDoc } from '../docs/parser';

import { I18nProvider } from '../i18n/I18nProvider';
import { useTranslation } from '../i18n/useTranslation';
import { Translations } from '../i18n/types';

import { FederatedComponent } from '../micro-frontend/FederatedComponent';
import { useModuleFederation } from '../micro-frontend/useModuleFederation';

import { useTheme } from '../../ui/theme/useTheme';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => <>{children}</>,
}));
jest.mock('../../ui/theme/useTheme', () => ({
  useTheme: jest.fn(),
}));

const ProblemChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test Error');
  }
  return <Text testID="content">All Good</Text>;
};

describe('Core Framework Unified Test Suite', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    consoleErrorSpy.mockClear();
    (useTheme as jest.Mock).mockReturnValue({
      theme: { mode: 'light' },
    });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  // ==========================================
  // 1. ErrorBoundary
  // ==========================================
  describe('ErrorBoundary', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={false} />
        </ErrorBoundary>
      );
      expect(screen.getByTestId('content').props.children).toBe('All Good');
    });

    it('renders default fallback UI on error', () => {
      render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByText('Test Error')).toBeTruthy();
    });

    it('allows retrying from default fallback UI', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );

      // Update props so it won't throw on the next render
      rerender(
        <ErrorBoundary>
          <ProblemChild shouldThrow={false} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByTestId('error-boundary-retry');
      fireEvent.press(retryButton);

      expect(screen.getByTestId('content')).toBeTruthy();
    });
  });

  // ==========================================
  // 2. MembraneProvider & useMembrane
  // ==========================================
  describe('MembraneProvider & useMembrane', () => {
    it('provides default membrane config when no config override is supplied', () => {
      const TestChild = () => {
        const membrane = useMembrane();
        return <Text testID="role">{membrane.getConfig().authorityRole}</Text>;
      };

      render(
        <MembraneProvider>
          <TestChild />
        </MembraneProvider>
      );

      expect(screen.getByTestId('role').props.children).toBe('anonymous');
    });

    it('allows configuration overrides', () => {
      const TestChild = () => {
        const membrane = useMembrane();
        return <Text testID="tenant">{membrane.getConfig().tenantId}</Text>;
      };

      render(
        <MembraneProvider config={{ tenantId: 'override-tenant' }}>
          <TestChild />
        </MembraneProvider>
      );

      expect(screen.getByTestId('tenant').props.children).toBe('override-tenant');
    });

    it('throws error when useMembrane is called outside MembraneProvider', () => {
      const TestComponent = () => {
        useMembrane();
        return null;
      };

      expect(() => render(<TestComponent />)).toThrow(
        'useMembrane must be used within a MembraneProvider'
      );
    });
  });

  // ==========================================
  // 3. PcpFrameworkProvider
  // ==========================================
  describe('PcpFrameworkProvider', () => {
    it('renders children correctly and integrates contexts', () => {
      const TestChild = () => {
        const membrane = useMembrane();
        return (
          <View>
            <Text testID="child-text">Child Rendered</Text>
            <Text testID="membrane-tenant">{membrane.getConfig().tenantId}</Text>
          </View>
        );
      };

      render(
        <PcpFrameworkProvider membraneConfig={{ tenantId: 'custom-test-tenant' }}>
          <TestChild />
        </PcpFrameworkProvider>
      );

      expect(screen.getByTestId('child-text').props.children).toBe('Child Rendered');
      expect(screen.getByTestId('membrane-tenant').props.children).toBe('custom-test-tenant');
    });

    it('catches render errors using internal ErrorBoundary', () => {
      const BadChild = () => {
        throw new Error('Integration Error');
      };

      render(
        <PcpFrameworkProvider>
          <BadChild />
        </PcpFrameworkProvider>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByText('Integration Error')).toBeTruthy();
    });
  });

  // ==========================================
  // 4. Docs System (Registry, Parser, DocExplorer)
  // ==========================================
  describe('Docs System', () => {
    beforeEach(() => {
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

    describe('JSDoc Parser', () => {
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
    });

    describe('DocRegistry', () => {
      it('should register and retrieve docs', () => {
        const jsDoc = `
          /**
           * @name useAuth
           * @description Auth hook
           */
        `;
        docRegistry.register(jsDoc);
        const docs = docRegistry.getAllDocs();
        expect(docs.find((d) => d.name === 'useAuth')).toBeDefined();
      });

      it('should allow overrides during registration', () => {
        const jsDoc = `
          /**
           * @name useAuth
           */
        `;
        docRegistry.register(jsDoc, { id: 'custom-id', type: 'hook' });
        const doc = docRegistry.getDoc('custom-id');
        expect(doc).toBeDefined();
        expect(doc?.type).toBe('hook');
      });

      it('should register metadata directly', () => {
        docRegistry.registerMetadata({
          id: 'manual',
          name: 'Manual',
          description: 'Manual doc',
          type: 'utility',
        });
        expect(docRegistry.getDoc('manual')).toBeDefined();
      });
    });

    describe('DocExplorer Component', () => {
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
    });
  });

  // ==========================================
  // 5. I18n System
  // ==========================================
  describe('I18n System', () => {
    const translations: Translations = {
      en: {
        welcome: 'Welcome {{name}}!',
        items: {
          zero: 'No items',
          one: 'One item',
          other: '{{count}} items',
        },
        nested: {
          key: 'Nested Value',
        },
        onlyInEn: 'English only',
      },
      es: {
        welcome: '¡Bienvenido {{name}}!',
        items: {
          zero: 'Sin artículos',
          one: 'Un artículo',
          other: '{{count}} artículos',
        },
      },
    };

    function I18nTestComponent() {
      const { t, setLocale, locale } = useTranslation();
      return (
        <View>
          <Text testID="welcome">{t('welcome', { name: 'Pcp' })}</Text>
          <Text testID="count-0">{t('items', { count: 0 })}</Text>
          <Text testID="count-1">{t('items', { count: 1 })}</Text>
          <Text testID="count-5">{t('items', { count: 5 })}</Text>
          <Text testID="nested">{t('nested.key')}</Text>
          <Text testID="locale">{locale}</Text>
          <Text testID="fallback">{t('onlyInEn')}</Text>
          <Pressable onPress={() => setLocale('es')} testID="switch-es">
            <Text>Switch to ES</Text>
          </Pressable>
          <Text testID="missing">{t('missing.key')}</Text>
        </View>
      );
    }

    it('translates basic keys and performs interpolation', () => {
      render(
        <I18nProvider translations={translations}>
          <I18nTestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('welcome').children[0]).toBe('Welcome Pcp!');
    });

    it('handles pluralization correctly', () => {
      render(
        <I18nProvider translations={translations}>
          <I18nTestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('count-0').children[0]).toBe('No items');
      expect(screen.getByTestId('count-1').children[0]).toBe('One item');
      expect(screen.getByTestId('count-5').children[0]).toBe('5 items');
    });

    it('resolves nested keys', () => {
      render(
        <I18nProvider translations={translations}>
          <I18nTestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('nested').children[0]).toBe('Nested Value');
    });
  });

  // ==========================================
  // 6. Micro-Frontend Module Federation
  // ==========================================
  describe('Micro-Frontend (useModuleFederation & FederatedComponent)', () => {
    const mockConfig = {
      name: 'testRemote',
      url: 'https://example.com/remoteEntry.js',
      scope: 'testScope',
      module: './testModule',
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should initialize with loading status and transition to ready', async () => {
      const { result } = renderHook(() => useModuleFederation(mockConfig));
      expect(result.current.status).toBe('loading');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.module).toBeDefined();
      expect(result.current.module.default).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    it('should transition to error status if no URL is provided', async () => {
      const invalidConfig = { ...mockConfig, url: '' };
      const { result } = renderHook(() => useModuleFederation(invalidConfig));

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toBe('No URL provided for federated module');
    });

    it('renders fallback while loading', async () => {
      render(<FederatedComponent {...mockConfig} fallback={<Text>Loading...</Text>} />);
      expect(screen.getByText('Loading...')).toBeDefined();

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.queryByText('Loading...')).toBeNull();
    });

    it('renders error component on failure', async () => {
      render(
        <FederatedComponent
          {...mockConfig}
          url="" // Trigger error
          errorComponent={(err) => <Text>Error: {err.message}</Text>}
        />
      );

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(screen.getByText('Error: No URL provided for federated module')).toBeDefined();
    });

    it('renders the federated component when ready', async () => {
      render(<FederatedComponent {...mockConfig} props={{ title: 'Hello from Remote' }} />);

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId('federated-stub')).toBeDefined();
      expect(screen.getByText('Federated Module: testRemote')).toBeDefined();
      expect(screen.getByText('Module: ./testModule')).toBeDefined();
    });
  });
});

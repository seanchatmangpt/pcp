import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { evaluateInCourt, skepticAgent, auditorAgent, advocateAgent, Mutation } from '../agents';
import { AgiCourtProvider, useAgiCourt } from '../AgiCourtContext';

const TestComponent = ({ mutation }: { mutation: Mutation }) => {
  const { proposeMutation, history } = useAgiCourt();
  return (
    <Text testID="btn" onPress={() => proposeMutation(mutation)}>
      {history.length}
    </Text>
  );
};

const ContextConsumer = () => {
  useAgiCourt();
  return null;
};

describe('AGI Court of Law', () => {
  describe('Agents', () => {
    it('should approve low tension mutations automatically', () => {
      const mutation: Mutation = { id: '1', type: 'TEST', payload: {}, tensionLevel: 'low' };
      const decision = evaluateInCourt(mutation);
      expect(decision.approved).toBe(true);
      expect(decision.verdicts.length).toBe(0);
    });

    it('should approve medium tension mutations automatically', () => {
      const mutation: Mutation = { id: '2', type: 'TEST', payload: {}, tensionLevel: 'medium' };
      const decision = evaluateInCourt(mutation);
      expect(decision.approved).toBe(true);
      expect(decision.verdicts.length).toBe(0);
    });

    it('should approve high tension mutation when all agents pass', () => {
      const mutation: Mutation = {
        id: '3',
        type: 'VALID_TYPE',
        payload: { someData: true },
        tensionLevel: 'high',
        metadata: { intent: 'user_action' },
      };
      const decision = evaluateInCourt(mutation);
      expect(decision.approved).toBe(true);
      expect(decision.verdicts.length).toBe(3);
    });

    it('Skeptic should reject if metadata is missing', () => {
      const mutation: Mutation = {
        id: '4',
        type: 'VALID_TYPE',
        payload: {},
        tensionLevel: 'high',
      };
      const verdict = skepticAgent(mutation);
      expect(verdict.approved).toBe(false);
      expect(verdict.reason).toContain('Lacks sufficient metadata context');

      const decision = evaluateInCourt(mutation);
      expect(decision.approved).toBe(false);
    });

    it('Skeptic should reject if metadata is empty', () => {
      const mutation: Mutation = {
        id: '4b',
        type: 'VALID_TYPE',
        payload: {},
        tensionLevel: 'high',
        metadata: {},
      };
      const verdict = skepticAgent(mutation);
      expect(verdict.approved).toBe(false);
    });

    it('Auditor should reject if payload contains __unsafe_bypass', () => {
      const mutation: Mutation = {
        id: '5',
        type: 'VALID_TYPE',
        payload: { __unsafe_bypass: true },
        tensionLevel: 'high',
        metadata: { intent: 'user_action' },
      };
      const verdict = auditorAgent(mutation);
      expect(verdict.approved).toBe(false);
      expect(verdict.reason).toContain('unsafe bypass flag');

      const decision = evaluateInCourt(mutation);
      expect(decision.approved).toBe(false);
    });

    it('Advocate should reject if type is UNKNOWN', () => {
      const mutation: Mutation = {
        id: '6',
        type: 'UNKNOWN',
        payload: {},
        tensionLevel: 'high',
        metadata: { intent: 'user_action' },
      };
      const verdict = advocateAgent(mutation);
      expect(verdict.approved).toBe(false);
      expect(verdict.reason).toContain('unknown mutation type');

      const decision = evaluateInCourt(mutation);
      expect(decision.approved).toBe(false);
    });

    it('Advocate should reject if type is missing', () => {
      const mutation: Mutation = {
        id: '7',
        type: '',
        payload: {},
        tensionLevel: 'high',
        metadata: { intent: 'user_action' },
      };
      const verdict = advocateAgent(mutation);
      expect(verdict.approved).toBe(false);
    });
  });

  describe('AgiCourtContext', () => {
    it('should throw an error when useAgiCourt is used outside of AgiCourtProvider', () => {
      const consoleError = console.error;
      console.error = jest.fn();

      expect(() => render(<ContextConsumer />)).toThrow(
        'useAgiCourt must be used within an AgiCourtProvider'
      );

      console.error = consoleError;
    });

    it('should provide context and track history', async () => {
      const mutation: Mutation = {
        id: '8',
        type: 'VALID_TYPE',
        payload: {},
        tensionLevel: 'high',
        metadata: { intent: 'user_action' },
      };

      const { getByTestId } = render(
        <AgiCourtProvider>
          <TestComponent mutation={mutation} />
        </AgiCourtProvider>
      );

      const btn = getByTestId('btn');
      expect(btn.props.children).toBe(0);

      await act(async () => {
        fireEvent.press(btn);
      });

      await waitFor(() => {
        expect(getByTestId('btn').props.children).toBe(1);
      });
    });
  });
});

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
  });
});

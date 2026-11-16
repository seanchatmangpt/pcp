import React from 'react';
import { View, Text } from 'react-native';
import { render, screen, act, waitFor } from '@testing-library/react-native';
import {
  OntologicalShifter,
  CoreLawEngine,
  PostCyberpunkProvider,
  usePostCyberpunk,
} from '../PostCyberpunkProvider';
import {
  PublicLaw,
  FutureClaim,
  ActuationBoundary,
  TypedArtifact,
} from '../../law-engine/interfaces';

describe('OntologicalShifter', () => {
  it('initializes with baseline dimension', () => {
    const shifter = new OntologicalShifter();
    expect(shifter.getCurrentDimension()).toBe('baseline');
  });

  it('shifts dimension when artifact permits', () => {
    const shifter = new OntologicalShifter();
    const artifact = {
      id: '1',
      claimId: 'c1',
      lawId: 'l1',
      approvedPayload: { permitShift: true },
    };
    const success = shifter.shift(artifact, { dimension: 'base', targetState: 'cyber-future' });
    expect(success).toBe(true);
    expect(shifter.getCurrentDimension()).toBe('cyber-future');
  });

  it('does not shift when artifact denies', () => {
    const shifter = new OntologicalShifter();
    const artifact = {
      id: '1',
      claimId: 'c1',
      lawId: 'l1',
      approvedPayload: { permitShift: false },
    };
    const success = shifter.shift(artifact, { dimension: 'base', targetState: 'cyber-future' });
    expect(success).toBe(false);
    expect(shifter.getCurrentDimension()).toBe('baseline');
  });
});

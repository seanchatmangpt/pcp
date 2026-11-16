import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { Pcp2030, usePcp2030 } from '../Pcp2030';

const mockInferenceEngine = {
  infer: jest.fn(),
} as any;

describe('Pcp2030 Ultimate Wrapper', () => {
  it('should provide genEx and predictive engines', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Pcp2030 inferenceEngine={mockInferenceEngine}>{children}</Pcp2030>
    );

    const { result } = renderHook(() => usePcp2030(), { wrapper });

    expect(result.current.genEx).toBeDefined();
    expect(result.current.predictive).toBeDefined();
    expect(result.current.version).toBe('2030.1.1-ultimate');
  });

  it('should throw error when used outside provider', () => {
    const t = () => {
      renderHook(() => usePcp2030());
    };
    expect(t).toThrow('usePcp2030 must be used within a Pcp2030 provider');
  });
});

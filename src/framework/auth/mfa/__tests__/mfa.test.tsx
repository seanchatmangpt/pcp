import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { MfaProvider } from '../MfaProvider';
import { useMfaVerification } from '../useMfaVerification';
import { MfaStrategy, MfaChallenge } from '../types';

describe('MFA Framework', () => {
  const mockOnInitiateChallenge = jest.fn();
  const mockOnVerifyCode = jest.fn();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MfaProvider
      onInitiateChallenge={mockOnInitiateChallenge}
      onVerifyCode={mockOnVerifyCode}
      verificationGracePeriod={1000}
    >
      {children}
    </MfaProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initiate a challenge when verify is called', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    let verifyPromise: any;
    await act(async () => {
      verifyPromise = result.current.verify({ strategy: 'totp' });
    });

    expect(mockOnInitiateChallenge).toHaveBeenCalledWith('totp');
    expect(result.current.activeChallenge).toEqual(challenge);
    expect(result.current.isPending).toBe(true);
  });

  it('should resolve verify promise when confirm is successful', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);
    mockOnVerifyCode.mockResolvedValue({ success: true, token: 'mfa-token-123' });

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    let verifyPromise: any;
    await act(async () => {
      verifyPromise = result.current.verify();
    });

    let confirmResult: boolean = false;
    await act(async () => {
      confirmResult = await result.current.confirm('123456');
    });

    expect(confirmResult).toBe(true);
    const verificationResult = await verifyPromise;
    expect(verificationResult).toEqual({ verified: true, token: 'mfa-token-123' });
    expect(result.current.isVerified).toBe(true);
    expect(result.current.activeChallenge).toBeNull();
  });

  it('should not resolve verify promise if confirm fails', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);
    mockOnVerifyCode.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    await act(async () => {
      result.current.verify();
    });

    let confirmResult: boolean = true;
    await act(async () => {
      confirmResult = await result.current.confirm('wrong-code');
    });

    expect(confirmResult).toBe(false);
    expect(result.current.isVerified).toBe(false);
    expect(result.current.activeChallenge).toEqual(challenge);
  });
});

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
      verificationGracePeriod={1000}>
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

  it('should handle cancelation', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    let verifyPromise: any;
    await act(async () => {
      verifyPromise = result.current.verify();
    });

    await act(async () => {
      result.current.cancel();
    });

    const verificationResult = await verifyPromise;
    expect(verificationResult).toEqual({ verified: false });
    expect(result.current.activeChallenge).toBeNull();
  });

  it('should skip verification if within grace period', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);
    mockOnVerifyCode.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    // First verification
    await act(async () => {
      result.current.verify();
    });
    await act(async () => {
      await result.current.confirm('123456');
    });

    expect(result.current.isVerified).toBe(true);
    expect(mockOnInitiateChallenge).toHaveBeenCalledTimes(1);

    // Second verification within grace period
    let secondVerifyResult: any;
    await act(async () => {
      secondVerifyResult = await result.current.verify();
    });

    expect(secondVerifyResult).toEqual({ verified: true });
    expect(mockOnInitiateChallenge).toHaveBeenCalledTimes(1); // No new challenge
  });

  it('should NOT skip verification if grace period expired', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);
    mockOnVerifyCode.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    // First verification
    await act(async () => {
      result.current.verify();
    });
    await act(async () => {
      await result.current.confirm('123456');
    });

    // Advance time past grace period (1000ms)
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Second verification
    await act(async () => {
      result.current.verify();
    });

    expect(mockOnInitiateChallenge).toHaveBeenCalledTimes(2);
  });

  it('should work with withMfa wrapper', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);
    mockOnVerifyCode.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    const sensitiveAction = jest.fn().mockResolvedValue('success-data');

    let actionPromise: any;
    await act(async () => {
      actionPromise = result.current.withMfa(sensitiveAction);
    });

    await act(async () => {
      await result.current.confirm('123456');
    });

    const actionResult = await actionPromise;
    expect(actionResult).toBe('success-data');
    expect(sensitiveAction).toHaveBeenCalled();
  });

  it('should not execute action if MFA fails in withMfa', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    const sensitiveAction = jest.fn();

    let actionPromise: any;
    await act(async () => {
      actionPromise = result.current.withMfa(sensitiveAction);
    });

    await act(async () => {
      result.current.cancel();
    });

    const actionResult = await actionPromise;
    expect(actionResult).toBeNull();
    expect(sensitiveAction).not.toHaveBeenCalled();
  });

  it('should handle errors in onInitiateChallenge', async () => {
    const error = new Error('Network error');
    mockOnInitiateChallenge.mockRejectedValue(error);

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    let verifyResult: any;
    await act(async () => {
      verifyResult = await result.current.verify();
    });

    expect(verifyResult).toEqual({ verified: false, error });
    expect(result.current.activeChallenge).toBeNull();
  });

  it('should return false for confirm if no active challenge', async () => {
    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    let confirmResult: boolean = true;
    await act(async () => {
      confirmResult = await result.current.confirm('123456');
    });

    expect(confirmResult).toBe(false);
  });

  it('should throw error if useMfa is used outside of MfaProvider', () => {
    // Suppress console.error for this test as we expect an error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useMfaVerification());
    }).toThrow('useMfa must be used within an MfaProvider');

    consoleSpy.mockRestore();
  });

  it('should handle errors in onVerifyCode', async () => {
    const challenge: MfaChallenge = {
      id: 'challenge-1',
      strategy: 'totp',
      expiresAt: Date.now() + 60000,
    };
    mockOnInitiateChallenge.mockResolvedValue(challenge);
    mockOnVerifyCode.mockRejectedValue(new Error('Verification service down'));

    const { result } = renderHook(() => useMfaVerification(), { wrapper });

    await act(async () => {
      result.current.verify();
    });

    let confirmResult: boolean = true;
    await act(async () => {
      confirmResult = await result.current.confirm('123456');
    });

    expect(confirmResult).toBe(false);
  });
});

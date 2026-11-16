import React, { ReactNode } from 'react';
import { PcpFrameworkProvider } from '@pcp/core/PcpFrameworkProvider';
import { AuthProvider as PcpAuthProvider } from '@pcp/auth/AuthProvider';
import { MfaProvider as PcpMfaProvider } from '@pcp/auth/mfa/MfaProvider';
import { GenExProvider } from '@pcp/2030/genex/GenExProvider';
import { TemporalProvider } from '@pcp/v30/temporal-routing/TemporalProvider';
import { PostCyberpunkProvider } from '@pcp/v30/post-cyberpunk/core/PostCyberpunkProvider';
import { ExperimentProvider } from '@pcp/dx/ab-testing/ExperimentProvider';

interface Props {
  children: ReactNode;
}

export function PcpCapabilitiesProvider({ children }: Props) {
  return (
    <PcpFrameworkProvider membraneConfig={{ mode: 'strict' }}>
      <PostCyberpunkProvider systemSecret="zoe-secret" laws={[]}>
        <PcpAuthProvider>
          <PcpMfaProvider
            onInitiateChallenge={async () => ({
              id: 'mock',
              strategy: 'totp',
              expiresAt: Date.now() + 60000,
            })}
            onVerifyCode={async () => ({ success: true })}
          >
            <GenExProvider>
              <TemporalProvider>
                <ExperimentProvider configs={[]}>{children}</ExperimentProvider>
              </TemporalProvider>
            </GenExProvider>
          </PcpMfaProvider>
        </PcpAuthProvider>
      </PostCyberpunkProvider>
    </PcpFrameworkProvider>
  );
}

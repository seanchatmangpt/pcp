import React, { ReactNode } from 'react';
import { PcpFrameworkProvider } from '@pcp/framework/core/PcpFrameworkProvider';
import { AuthProvider as PcpAuthProvider } from '@pcp/framework/auth/AuthProvider';
import { MfaProvider as PcpMfaProvider } from '@pcp/framework/auth/mfa/MfaProvider';
import { GenExProvider } from '@pcp/framework/2030/genex/GenExProvider';
import { TemporalProvider } from '@pcp/framework/v30/temporal-routing/TemporalProvider';
import { PostCyberpunkProvider } from '@pcp/framework/v30/post-cyberpunk/core/PostCyberpunkProvider';
import { ExperimentProvider } from '@pcp/framework/dx/ab-testing/ExperimentProvider';

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

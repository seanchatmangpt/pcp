import { admitRoute, DEFAULT_IDENTITY_HIERARCHY } from '../guards';

describe('admitRoute', () => {
  it('allows access if no restrictions are specified', () => {
    const { admitted } = admitRoute(undefined, {});
    expect(admitted).toBe(true);
  });

  it('rejects if required boundary is invalid', () => {
    const { admitted, refusal } = admitRoute(undefined, { requiredIdentityBoundary: 'unknown' });
    expect(admitted).toBe(false);
    expect(refusal?.code).toBe('INVALID_CONFIGURATION');
  });

  it('rejects unauthenticated users trying to access protected route', () => {
    const { admitted, refusal } = admitRoute(
      { identityBoundary: 'anonymous', disclosures: [] },
      { requiredIdentityBoundary: 'authenticated' }
    );
    expect(admitted).toBe(false);
    expect(refusal?.code).toBe('UNAUTHENTICATED');
  });
});

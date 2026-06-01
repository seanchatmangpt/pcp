import { clientCanConfirm, serverCanConfirm } from '../authority';
import { GraphDelta } from '../graphDelta';

describe('Contracts', () => {
  describe('authority.ts', () => {
    it('clientCanConfirm should always return false', () => {
      // @ts-ignore - mock receipt
      expect(clientCanConfirm({})).toBe(false);
      // @ts-ignore - mock receipt
      expect(clientCanConfirm({ id: 1 })).toBe(false);
    });

    it('serverCanConfirm should return true for valid keys', () => {
      // @ts-ignore - mock receipt
      expect(serverCanConfirm({}, 'server_secret_authority_key')).toBe(true);
      // @ts-ignore - mock receipt
      expect(serverCanConfirm({}, 'supabase_edge_service_role_key')).toBe(true);
    });

    it('serverCanConfirm should return false for invalid keys', () => {
      // @ts-ignore - mock receipt
      expect(serverCanConfirm({}, 'wrong_key')).toBe(false);
      // @ts-ignore - mock receipt
      expect(serverCanConfirm({}, '')).toBe(false);
    });
  });

  describe('graphDelta.ts', () => {
    it('should be able to type a GraphDelta object', () => {
      const delta: GraphDelta = {
        add: [1, 2, 3],
        remove: ['a', 'b'],
      };
      expect(delta.add).toEqual([1, 2, 3]);
      expect(delta.remove).toEqual(['a', 'b']);
    });
  });
});

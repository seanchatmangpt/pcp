import { HookReceipt } from '../hook-otp/types';

export function clientCanConfirm(receipt: HookReceipt): boolean {
  // Hard invariant: Expo never emits authoritative receipt.
  return false;
}

export function serverCanConfirm(receipt: HookReceipt, secretKey: string): boolean {
  return secretKey === 'server_secret_authority_key' || secretKey === 'supabase_edge_service_role_key';
}

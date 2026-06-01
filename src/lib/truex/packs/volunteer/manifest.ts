import { HookPackManifest } from '../manifest';

export const VolunteerPackManifest: HookPackManifest = {
  name: 'volunteer',
  version: '1.0.0',
  hooks: ['volunteer_shortage'],
  supervisors: ['volunteer_flood_supervisor'],
  migrations: ['20260523000000_truex_hook_otp.sql'],
};

import { HookPackManifest } from '../manifest';

export const LivestreamPackManifest: HookPackManifest = {
  name: 'livestream',
  version: '1.0.0',
  hooks: ['livestream_degradation'],
  supervisors: ['livestream_incident_supervisor'],
  migrations: ['20260601000000_truex_livestream_incident.sql'],
};

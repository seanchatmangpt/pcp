import { DefaultHookSupervisor } from '../../hook-otp/supervisor';

export const livestreamIncidentSupervisor = new DefaultHookSupervisor(5, 20);

import { DefaultHookSupervisor } from '../../hook-otp/supervisor';

export const volunteerFloodSupervisor = new DefaultHookSupervisor(3, 10);

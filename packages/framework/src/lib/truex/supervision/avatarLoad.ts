import { SupervisorAction } from '../hook-otp/types';

export class AvatarLoadSupervisor {
  private maxLoadFactor: number;

  constructor(maxLoadFactor = 0.85) {
    this.maxLoadFactor = maxLoadFactor;
  }

  public checkLoad(loadFactor: number): SupervisorAction | 'allow' {
    if (loadFactor > this.maxLoadFactor) {
      return 'suppress';
    }
    return 'allow';
  }
}

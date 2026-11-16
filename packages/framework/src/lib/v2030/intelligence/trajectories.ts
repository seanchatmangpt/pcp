/**
 * @fileoverview Transition Family definitions and trajectory gating logic.
 */

export interface TransitionFamily {
  id: string;
  states: string[];
  allowedTransitions: Record<string, string[]>;
  initialState: string;
}

export const SermonFlow: TransitionFamily = {
  id: 'SermonFlow',
  states: ['idle', 'drafted', 'reviewed', 'published', 'archived'],
  allowedTransitions: {
    idle: ['drafted'],
    drafted: ['reviewed'],
    reviewed: ['published'],
    published: ['archived'],
    archived: [],
  },
  initialState: 'idle',
};

export const OrderFlow: TransitionFamily = {
  id: 'OrderFlow',
  states: ['idle', 'cart_updated', 'address_added', 'processing', 'paid'],
  allowedTransitions: {
    idle: ['cart_updated'],
    cart_updated: ['address_added'],
    address_added: ['processing'],
    processing: ['paid'],
    paid: [],
  },
  initialState: 'idle',
};

export const VolunteerFlow: TransitionFamily = {
  id: 'VolunteerFlow',
  states: ['idle', 'applied', 'interview_scheduled', 'approved', 'assigned'],
  allowedTransitions: {
    idle: ['applied'],
    applied: ['interview_scheduled'],
    interview_scheduled: ['approved'],
    approved: ['assigned'],
    assigned: [],
  },
  initialState: 'idle',
};

const FAMILIES: Record<string, TransitionFamily> = {
  SermonFlow,
  OrderFlow,
  VolunteerFlow,
};

/**
 * Validates whether a state progression trajectory follows permitted transition paths.
 * Returns { success: true } if valid, or a refusal message if an illegal transition is detected.
 */
export function validateTrajectory(
  familyId: string,
  trajectory: string[]
): { success: boolean; error?: string } {
  const family = FAMILIES[familyId];
  if (!family) {
    return {
      success: false,
      error: `TransitionFamilyRefused: Unknown transition family '${familyId}'`,
    };
  }

  if (trajectory.length === 0) {
    return { success: true };
  }

  // Enforce trajectory must start at the initial state
  if (trajectory[0] !== family.initialState) {
    return {
      success: false,
      error: `TransitionFamilyRefused: Trajectory in ${familyId} must start at initial state '${family.initialState}' (got '${trajectory[0]}')`,
    };
  }

  for (let i = 0; i < trajectory.length - 1; i++) {
    const currentState = trajectory[i];
    const nextState = trajectory[i + 1];

    if (!family.states.includes(currentState)) {
      return {
        success: false,
        error: `TransitionFamilyRefused: Invalid state '${currentState}' in ${familyId}`,
      };
    }
    if (!family.states.includes(nextState)) {
      return {
        success: false,
        error: `TransitionFamilyRefused: Invalid state '${nextState}' in ${familyId}`,
      };
    }

    const allowed = family.allowedTransitions[currentState] || [];
    if (!allowed.includes(nextState)) {
      // Find skipped intermediate states to print a nice refusal details string
      const currentIdx = family.states.indexOf(currentState);
      const nextIdx = family.states.indexOf(nextState);

      if (currentIdx !== -1 && nextIdx !== -1 && nextIdx > currentIdx + 1) {
        const skipped = family.states.slice(currentIdx + 1, nextIdx);
        return {
          success: false,
          error: `TransitionFamilyRefused: Illegal transition from '${currentState}' to '${nextState}' in ${familyId}. Missing required intermediate states: ${skipped.join(', ')}`,
        };
      }

      return {
        success: false,
        error: `TransitionFamilyRefused: Illegal transition from '${currentState}' to '${nextState}' in ${familyId}`,
      };
    }
  }

  return { success: true };
}

/**
 * UserExperienceObserver
 *
 * Part of the AUTONOMIC_VALIDATION suite (Agent 3/10).
 * Hooks into PCP UI components to verify visual outcomes of simulations.
 */

export interface VisualEvidence {
  type: 'View' | 'Text';
  props: any;
  timestamp: number;
}

export class UserExperienceObserver {
  private static instance: UserExperienceObserver;
  private evidences: VisualEvidence[] = [];
  private isEnabled: boolean = true;

  private constructor() {
    // Initialized for vision2030 simulation validation.
  }

  public static getInstance(): UserExperienceObserver {
    if (!UserExperienceObserver.instance) {
      UserExperienceObserver.instance = new UserExperienceObserver();
    }
    return UserExperienceObserver.instance;
  }

  /**
   * Records a visual event from a hooked component.
   */
  public record(type: 'View' | 'Text', props: any) {
    if (!this.isEnabled) return;

    this.evidences.push({
      type,
      props: this.sanitizeProps(props),
      timestamp: Date.now(),
    });

    if (this.evidences.length > 1000) {
      this.evidences.shift();
    }
  }

  /**
   * Asserts that the current UI state matches the expected visual adaptation.
   */
  public assertVisualAdaptation(expectedTrait: string) {
    const found = this.evidences.some((ev) => {
      const props = ev.props || {};
      return (
        props.trait === expectedTrait ||
        props.adaptation === expectedTrait ||
        (typeof props.className === 'string' && props.className.includes(expectedTrait)) ||
        (props.testID && props.testID.includes(expectedTrait))
      );
    });

    if (!found) {
      throw new Error(
        `[UserExperienceObserver] Assertion Failed: Visual adaptation "${expectedTrait}" not detected.`
      );
    }

    console.log(
      `[UserExperienceObserver] Assertion Passed: Visual adaptation "${expectedTrait}" verified.`
    );
  }

  private sanitizeProps(props: any): any {
    if (!props) return {};
    const sanitized: any = {};
    const allowedKeys = ['className', 'testID', 'trait', 'adaptation', 'children'];

    for (const key of allowedKeys) {
      if (props[key] !== undefined) {
        if (key === 'children' && typeof props[key] !== 'string') continue;
        sanitized[key] = props[key];
      }
    }
    return sanitized;
  }

  public clear() {
    this.evidences = [];
  }
}

export const uxObserver = UserExperienceObserver.getInstance();

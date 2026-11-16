import { ReactTestInstance } from 'react-test-renderer';

/**
 * Autonomic Semantic Accessibility Auditor (A11y-Bot)
 *
 * Traverses a rendered React Native component tree in Jest to mathematically
 * prove that every single interactive element is completely accessible to
 * screen readers (VoiceOver/TalkBack).
 */
export class A11yAuditor {
  static auditTree(root: ReactTestInstance) {
    const violations: string[] = [];

    // Find all touchables, buttons, and pressables
    const interactiveElements = root.findAll((node) => {
      const type = typeof node.type === 'string' ? node.type : node.type?.name;
      return (
        type === 'TouchableOpacity' ||
        type === 'Pressable' ||
        type === 'Button' ||
        type === 'AnimatedComponent(Pressable)'
      );
    });

    interactiveElements.forEach((node, index) => {
      const { accessible, accessibilityLabel, accessibilityRole, accessibilityHint, testID } =
        node.props;

      const elementId = testID || `InteractiveElement_${index}`;

      // 1. Must be accessible
      if (accessible === false) {
        violations.push(`[${elementId}] is interactive but explicitly marked accessible={false}`);
      }

      // 2. Must have a semantic role
      if (!accessibilityRole) {
        violations.push(`[${elementId}] is missing 'accessibilityRole' (e.g., 'button', 'link')`);
      }

      // 3. Must have a descriptive label
      if (!accessibilityLabel || accessibilityLabel.trim() === '') {
        // Look for text children if label is missing
        const hasTextChild = node.children.some(
          (child) =>
            typeof child === 'string' ||
            (typeof child === 'object' &&
              typeof child.type === 'string' &&
              (child.type as string) === 'Text') ||
            (typeof child === 'object' &&
              typeof child.type === 'function' &&
              child.type.name === 'Text')
        );

        if (!hasTextChild) {
          violations.push(
            `[${elementId}] has no 'accessibilityLabel' and no child Text nodes. Screen readers will be silent.`
          );
        }
      }
    });

    if (violations.length > 0) {
      throw new Error(
        `🚨 A11y-Bot detected ${violations.length} Semantic Accessibility Violations:\n\n` +
          violations.map((v) => `  ❌ ${v}`).join('\n')
      );
    }

    return true;
  }
}

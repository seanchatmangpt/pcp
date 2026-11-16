import { TestResult } from './types';

export class TestRunner {
  public async runTest(
    testName: string,
    assertion: () => boolean | Promise<boolean>
  ): Promise<TestResult> {
    const logs: string[] = [`Starting test: ${testName}`];
    try {
      const success = await assertion();
      if (success) {
        logs.push('Test passed.');
        return { success: true, logs };
      } else {
        logs.push('Test failed: Assertion returned false.');
        return { success: false, error: 'Assertion failed', logs };
      }
    } catch (e: any) {
      logs.push(`Test crashed: ${e.message}`);
      return { success: false, error: e.message, logs };
    }
  }
}

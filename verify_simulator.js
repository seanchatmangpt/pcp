const { execSync } = require('child_process');

console.log('===============================================================');
console.log('🤖 Post-Cyberpunk (PCP) Framework - E2E Simulator Verification 🤖');
console.log('===============================================================\n');

try {
  console.log('⏳ Running E2E Test Suite via Jest...');
  execSync('npx jest src/test/e2e_simulator_verification.test.ts --forceExit --no-cache', { stdio: 'inherit' });
  console.log('\n===============================================================');
  console.log('✅ ALL 10 CORE FEATURES VERIFIED IN SIMULATED NATIVE ENVIRONMENT');
  console.log('===============================================================');
  process.exit(0);
} catch (error) {
  console.error('\n===============================================================');
  console.error('❌ E2E SIMULATOR VERIFICATION FAILED.');
  console.error('===============================================================');
  process.exit(1);
}

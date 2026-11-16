#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================================="
echo "📱 BOOTING / MOCKING REACT NATIVE SIMULATED ENVIRONMENT 📱"
echo "========================================================="

# Exporting mock native flags for environment setup
export REACT_NATIVE_SIMULATOR_MOCK=true
export NODE_ENV=test

echo "---------------------------------------------------------"
echo "🧪 Running E2E Simulator Verification Test Suite..."
echo "---------------------------------------------------------"

if npx jest src/test/e2e_simulator_verification.test.ts --forceExit --no-cache; then
  echo "========================================================="
  echo "✅ E2E SIMULATOR VERIFICATION SUCCEEDED!"
  echo "========================================================="
  exit 0
else
  echo "========================================================="
  echo "❌ E2E SIMULATOR VERIFICATION FAILED."
  echo "========================================================="
  exit 1
fi

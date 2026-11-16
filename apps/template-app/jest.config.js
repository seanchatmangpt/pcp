module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/jest-setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|moti)',
  ],
  moduleNameMapper: {
    '^react$': '<rootDir>/../../node_modules/react',
    '^react-native$': '<rootDir>/../../node_modules/react-native',
    '^react-test-renderer$': '<rootDir>/../../node_modules/react-test-renderer',
    '^@pcp/framework/(.*)$': '<rootDir>/src/framework/$1',
    '^@pcp/(.*)$': '<rootDir>/src/framework/$1',
    '^@/src/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
};

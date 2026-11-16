module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/jest-setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|moti)',
  ],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/src/test/styleMock.ts',
    '^@pcp/framework/(.*)$': '<rootDir>/src/framework/$1',
    '^@pcp/(.*)$': '<rootDir>/src/framework/$1',
    '^@\\/(.*)$': '<rootDir>/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.test.{js,jsx,ts,tsx}'],
  modulePathIgnorePatterns: ['<rootDir>/supabase/', '<rootDir>/packages/', '<rootDir>/apps/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/supabase/', '<rootDir>/packages/', '<rootDir>/apps/'],
};

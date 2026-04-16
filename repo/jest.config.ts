import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { module: 'commonjs' },
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Provide env var fallbacks before any module loads (runs before each worker)
  setupFiles: ['<rootDir>/tests/jest-setup-env.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/types/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};

export default config;

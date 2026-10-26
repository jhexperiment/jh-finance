import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@libs/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@libs/config(|/.*)$': '<rootDir>/libs/config/src/$1',
    '^@generated/prisma$': '<rootDir>/generated/prisma',
    '^shared$': '<rootDir>/../../packages/shared/src',
  },
};

export default config;

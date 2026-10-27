import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.m?js$': ['ts-jest', { tsconfig: { allowJs: true, esModuleInterop: true } }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(?:@scure\\+|@noble\\+|micro-packed@)|(?:@scure|@noble|micro-packed)/))',
  ],
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

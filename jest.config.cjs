module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2022' }, module: { type: 'commonjs' } }] },
  moduleNameMapper: {
    '^@prius/obd-core$': '<rootDir>/packages/obd-core/src/index.ts',
    '^@prius/elm327$': '<rootDir>/packages/elm327/src/index.ts',
    '^@prius/vehicle-profiles$': '<rootDir>/packages/vehicle-profiles/src/index.ts',
    '^@prius/telemetry$': '<rootDir>/packages/telemetry/src/index.ts',
    '^@prius/shared$': '<rootDir>/packages/shared/src/index.ts'
  }
};

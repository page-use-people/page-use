/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    moduleFileExtensions: ['mts', 'ts', 'mjs', 'js', 'json'],
    resolver: './jest-resolver.cjs',
    transform: {
        '^.+\\.mts$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.json',
            },
        ],
    },
    testMatch: ['**/*.test.mts'],
};

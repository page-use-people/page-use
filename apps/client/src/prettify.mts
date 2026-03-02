import prettier from 'prettier';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginTypescript from 'prettier/plugins/typescript';

const PRETTIER_OPTIONS = Object.freeze({
    parser: 'typescript' as const,
    plugins: [prettierPluginEstree, prettierPluginTypescript],
    bracketSpacing: false,
    singleQuote: true,
    trailingComma: 'all' as const,
    tabWidth: 4,
}) satisfies prettier.Options;

export const prettify = async (tsCode: string): Promise<string> =>
    prettier.format(tsCode, PRETTIER_OPTIONS);

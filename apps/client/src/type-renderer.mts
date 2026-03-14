import ts from 'typescript';
import {z} from 'zod';
import {
    zodToTs,
    printNode,
    createTypeAlias,
    createAuxiliaryTypeStore,
} from 'zod-to-ts';
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

const prettify = async (tsCode: string): Promise<string> =>
    prettier.format(tsCode, PRETTIER_OPTIONS);

export const renderFunctionType = async (
    name: string,
    inputParameterType: z.ZodType,
    outputType: z.ZodType,
    comment: string,
): Promise<string> => {
    const store = createAuxiliaryTypeStore();
    const inputTypescript = printNode(
        zodToTs(inputParameterType, {auxiliaryTypeStore: store}).node,
    );
    const outputTypescript = printNode(
        zodToTs(outputType, {auxiliaryTypeStore: store}).node,
    );

    const inputComment = inputParameterType.description
        ? `/** ${inputParameterType.description} */ `
        : '';
    const outputComment = outputType.description
        ? `/** ${outputType.description} */ `
        : '';

    return prettify(`
        /** ${comment} */
        async function ${name}(input: ${inputComment}${inputTypescript}): Promise<${outputComment}${outputTypescript}>;
    `);
};

export const renderVariableInterface = async (
    type: z.ZodType,
): Promise<string> => {
    const store = createAuxiliaryTypeStore();
    const {node} = zodToTs(type, {auxiliaryTypeStore: store});
    const sourceFile = ts.createSourceFile(
        'output.ts',
        '',
        ts.ScriptTarget.Latest,
    );
    const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
    const typeAlias = createTypeAlias(node, 'TVariables', type.description);
    return prettify(
        printer.printNode(ts.EmitHint.Unspecified, typeAlias, sourceFile),
    );
};

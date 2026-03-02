import * as Diff from 'diff';
import prettier from 'prettier';

type TCodeService = {
    readonly formatWithLineNumbers: (code: string) => Promise<string>;
    readonly applyPatch: (originalCode: string, patch: string) => string;
};

const createCodeService = (): TCodeService => {
    const formatWithLineNumbers = async (code: string): Promise<string> => {
        // 1. Run prettier (with error fallback)
        let formatted: string;
        try {
            formatted = await prettier.format(code, {
                parser: 'babel',
                bracketSpacing: false,
                singleQuote: true,
                trailingComma: 'all',
                tabWidth: 4,
            });
        } catch {
            // If prettier fails (syntax error), use original code
            formatted = code;
        }

        // Remove trailing newline added by prettier
        const trimmed = formatted.endsWith('\n')
            ? formatted.slice(0, -1)
            : formatted;

        // 2. Add line numbers (matching the format: "     1→...")
        const lines = trimmed.split('\n');
        const maxLineNumWidth = Math.max(String(lines.length).length, 5);

        return lines
            .map((line, i) => {
                const lineNum = String(i + 1).padStart(maxLineNumWidth, ' ');
                return `${lineNum}\u2192${line}`;
            })
            .join('\n');
    };

    const applyPatch = (originalCode: string, patch: string): string => {
        const result = Diff.applyPatch(originalCode, patch);
        if (result === false) {
            throw new Error('Failed to apply patch');
        }
        return result;
    };

    return Object.freeze({formatWithLineNumbers, applyPatch});
};

export {createCodeService};
export type {TCodeService};

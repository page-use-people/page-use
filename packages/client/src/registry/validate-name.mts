const RESERVED_KEYWORDS = Object.freeze([
    'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'double', 'else', 'enum', 'eval', 'export', 'extends', 'false', 'final',
    'finally', 'float', 'for', 'function', 'goto', 'if', 'implements', 'import',
    'in', 'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new',
    'null', 'package', 'private', 'protected', 'public', 'return', 'short',
    'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
    'transient', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'volatile',
    'while', 'with', 'yield',
] as const);

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export const validateName = (name: string): void => {
    if (!VALID_IDENTIFIER.test(name)) {
        throw new Error(
            `Invalid name "${name}": must be a valid JavaScript identifier (letters, digits, _, $)`,
        );
    }

    if ((RESERVED_KEYWORDS as readonly string[]).includes(name)) {
        throw new Error(`Invalid name "${name}": reserved JavaScript keyword`);
    }
};

// ── Types ──────────────────────────────────────────────────

type TSearchReplaceBlock = {
    readonly search: string;
    readonly replace: string;
};

type TCodeService = {
    readonly applyEdits: (originalCode: string, edits: string) => string;
};

// ── SEARCH/REPLACE Parsing ─────────────────────────────────

const SEARCH_REPLACE_PATTERN =
    /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

const parseSearchReplaceBlocks = (
    edits: string,
): readonly TSearchReplaceBlock[] => {
    const blocks = Array.from(edits.matchAll(SEARCH_REPLACE_PATTERN)).map(
        (match) => ({
            search: match[1],
            replace: match[2],
        }),
    );

    if (blocks.length === 0) {
        throw new Error(
            'No valid SEARCH/REPLACE blocks found. Use the <<<<<<< SEARCH / ======= / >>>>>>> REPLACE format.',
        );
    }

    const emptySearch = blocks.find((b) => b.search.trim() === '');
    if (emptySearch) {
        throw new Error(
            'Empty SEARCH block found. The SEARCH section must contain the exact code to find.',
        );
    }

    return blocks;
};

// ── Edit Application ───────────────────────────────────────

const countOccurrences = (code: string, search: string): number => {
    let count = 0;
    let pos = 0;
    while (true) {
        const idx = code.indexOf(search, pos);
        if (idx === -1) {
            return count;
        }
        count++;
        pos = idx + 1;
    }
};

const applySingleEdit = (
    code: string,
    block: TSearchReplaceBlock,
): string => {
    const matches = countOccurrences(code, block.search);

    if (matches === 0) {
        throw new Error(
            'SEARCH block not found in code. Make sure the SEARCH content exactly matches the existing code, including whitespace and indentation.',
        );
    }

    if (matches > 1) {
        throw new Error(
            `SEARCH block matches ${matches} locations. Add more surrounding context lines to make the match unique.`,
        );
    }

    const idx = code.indexOf(block.search);
    return code.slice(0, idx) + block.replace + code.slice(idx + block.search.length);
};

// ── Service Factory ────────────────────────────────────────

const createCodeService = (): TCodeService => {
    const applyEdits = (originalCode: string, edits: string): string =>
        parseSearchReplaceBlocks(edits).reduce(
            (code, block) => applySingleEdit(code, block),
            originalCode,
        );

    return Object.freeze({applyEdits});
};

export {createCodeService};
export type {TCodeService};

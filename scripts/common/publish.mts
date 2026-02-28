import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';

export type TBump = 'major' | 'minor' | 'patch';

export type TVersion = {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
};

export const die = (msg: string): never => {
    console.error(`Error: ${msg}`);
    process.exit(1);
};

export const createGit =
    (cwd?: string) =>
    (...args: ReadonlyArray<string>): string =>
        execFileSync('git', [...args], {encoding: 'utf-8', cwd}).trim();

export const parseBump = (
    args: ReadonlyArray<string>,
    scriptName: string,
): TBump => {
    const flags: Record<string, TBump> = {
        '--major': 'major',
        '--minor': 'minor',
        '--patch': 'patch',
    };
    const bumps = args
        .map((a) => flags[a])
        .filter((b): b is TBump => b !== undefined);

    return bumps.length === 1
        ? bumps[0]
        : die(`Usage: pnpm ${scriptName} --major|--minor|--patch`);
};

export const parseVersion = (version: string): TVersion => {
    const parts = version.split('.').map(Number);
    return parts.length === 3 && parts.every((n) => !isNaN(n))
        ? {major: parts[0]!, minor: parts[1]!, patch: parts[2]!}
        : die(`Invalid version: ${version}`);
};

export const bumpVersion = (v: TVersion, bump: TBump): TVersion =>
    bump === 'major'
        ? {major: v.major + 1, minor: 0, patch: 0}
        : bump === 'minor'
          ? {major: v.major, minor: v.minor + 1, patch: 0}
          : {major: v.major, minor: v.minor, patch: v.patch + 1};

export const formatVersion = (v: TVersion): string =>
    `${v.major}.${v.minor}.${v.patch}`;

export const readPkg = (
    pkgPath: string,
): {readonly pkg: Record<string, unknown>; readonly current: TVersion} => {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<
        string,
        unknown
    >;
    const current = parseVersion(pkg.version as string);
    return {pkg, current};
};

export const writePkg = (
    pkgPath: string,
    pkg: Record<string, unknown>,
    newVersion: string,
): void => {
    writeFileSync(
        pkgPath,
        JSON.stringify({...pkg, version: newVersion}, null, 4) + '\n',
    );
};

export const confirm = async (question: string): Promise<void> => {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const answer = await rl.question(`${question} [y/N] `);
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
    }
};

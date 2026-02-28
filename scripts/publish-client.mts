import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    createGit,
    parseBump,
    readPkg,
    writePkg,
    formatVersion,
    bumpVersion,
    confirm,
    die,
} from './common/publish.mts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_PKG = resolve(SCRIPT_DIR, '..', 'apps', 'client', 'package.json');
const git = createGit();

const main = async (): Promise<void> => {
    if (git('status', '--porcelain').length > 0) {
        die('Working tree is dirty. Commit or stash changes first.');
    }

    const bump = parseBump(process.argv.slice(2), 'publish-client');
    const {pkg, current} = readPkg(CLIENT_PKG);
    const next = bumpVersion(current, bump);
    const newVersion = formatVersion(next);

    await confirm(`Bump ${formatVersion(current)} -> ${newVersion} (${bump})?`);

    writePkg(CLIENT_PKG, pkg, newVersion);
    git('add', CLIENT_PKG);
    git('commit', '-m', `client-v${newVersion}`);
    git('tag', `client-v${newVersion}`);
    git('push');
    git('push', 'origin', `client-v${newVersion}`);

    console.log(`Published client-v${newVersion}`);
};

await main();

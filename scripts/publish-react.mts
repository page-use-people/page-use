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
const REACT_PKG = resolve(SCRIPT_DIR, '..', 'apps', 'react', 'package.json');
const git = createGit();

const main = async (): Promise<void> => {
    if (git('status', '--porcelain').length > 0) {
        die('Working tree is dirty. Commit or stash changes first.');
    }

    const bump = parseBump(process.argv.slice(2), 'publish-react');
    const {pkg, current} = readPkg(REACT_PKG);
    const next = bumpVersion(current, bump);
    const newVersion = formatVersion(next);

    await confirm(`Bump ${formatVersion(current)} -> ${newVersion} (${bump})?`);

    writePkg(REACT_PKG, pkg, newVersion);
    git('add', REACT_PKG);
    git('commit', '-m', `react-v${newVersion}`);
    git('tag', `react-v${newVersion}`);
    git('push');
    git('push', 'origin', `react-v${newVersion}`);

    console.log(`Published react-v${newVersion}`);
};

await main();

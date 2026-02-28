import {createHash} from 'node:crypto';
import * as prand from 'pure-rand';
import {uuidv7} from 'uuidv7';
import {Uuid25} from 'uuid25';

// ── ID generation ──────────────────────────────────────────

export const generateId = (): string => Uuid25.parse(uuidv7()).value;

export const toDBId = (id: string): string =>
    Uuid25.parseUuid25(id).toHyphenated();

export const fromDBId = (uuid: string): string =>
    Uuid25.parseHyphenated(uuid).value;

// ── Seeded PRNG (pure-rand + node:crypto) ──────────────────

const SEED = 'page_use_by_airstate_studio';
const ID_LENGTH = 25;

const stringToSeed = (s: string): number =>
    createHash('md5').update(s).digest().readInt32BE(0);

const createRng = (seed: string): (() => number) => {
    let rng = prand.xoroshiro128plus(stringToSeed(seed));
    return () => {
        const out = prand.unsafeUniformIntDistribution(0, 0x7fffffff, rng);
        return out / 0x80000000;
    };
};

// ── Precomputed permutation pair (fixed seed) ──────────────

const buildPermutations = (seed: string) => {
    const random = createRng(seed);

    // Fisher-Yates: build forward + inverse in one O(n) pass
    const perm = Array.from({length: ID_LENGTH}, (_, i) => i);
    const inv = Array.from({length: ID_LENGTH}, (_, i) => i);

    for (let i = ID_LENGTH - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
        inv[perm[i]] = i;
        inv[perm[j]] = j;
    }

    return {perm, inv} as const;
};

const {perm: PERM, inv: INV} = buildPermutations(SEED);

// ── Jumble / Unjumble ──────────────────────────────────────

export const jumble = (id: string): string => {
    const random = createRng(id);

    return PERM.map((srcIdx) =>
        random() < 0.4 ? id[srcIdx].toUpperCase() : id[srcIdx],
    ).join('');
};

export const unjumble = (jumbled: string): string =>
    INV.map((i) => jumbled.toLowerCase()[i]).join('');

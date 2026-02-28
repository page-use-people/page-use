# Publishing

This repo uses [changesets](https://github.com/changesets/changesets) for versioning and npm publishing.
`@page-use/client` and `@page-use/react` are **fixed** — they always share the same version number.

## How It Works

```
Add changeset → Merge PR → Version PR created → Merge version PR → Auto-publish to npm
```

1. You make changes and run `pnpm changeset` to describe them
2. The changeset file gets committed with your PR
3. When your PR merges to `main`, a "Version Packages" PR is automatically created/updated
4. That PR bumps versions in `package.json` files and updates `CHANGELOG.md`
5. When the version PR is merged, packages are automatically published to npm

## Day-to-Day Workflow

### 1. Create a changeset

After making changes to `@page-use/client` or `@page-use/react`:

```sh
pnpm changeset
```

This prompts you to:

- Select which packages changed (both client and react will be bumped together regardless)
- Choose a bump type: `patch` (bug fix), `minor` (new feature), or `major` (breaking change)
- Write a summary of the change

A markdown file is created in `.changeset/` — commit it with your PR.

### 2. Merge your PR

Once your PR merges to `main`, the [Version Packages](../../actions/workflows/version.yml) workflow runs and creates (or updates) a PR titled **"Version Packages"**.

### 3. Merge the version PR

Review the version PR — it contains:

- Bumped `version` fields in `apps/client/package.json` and `apps/react/package.json`
- Updated `CHANGELOG.md` files with your changeset summaries

Merge it when ready. The [Release](../../actions/workflows/release.yml) workflow then publishes both packages to npm.

## Bump Types

| Type    | When to use                          | Example           |
| ------- | ------------------------------------ | ----------------- |
| `patch` | Bug fixes, docs, internal changes    | `0.2.0` → `0.2.1` |
| `minor` | New features, non-breaking additions | `0.2.0` → `0.3.0` |
| `major` | Breaking API changes                 | `0.2.0` → `1.0.0` |

Because client and react are in a **fixed** group, a changeset on either package bumps both to the same version.

## One-Time Setup: npm OIDC Publishing

This repo uses [npm provenance](https://docs.npmjs.com/generating-provenance-statements) via GitHub Actions OIDC — no npm tokens needed.

For each package (`@page-use/client` and `@page-use/react`), configure a **trusted publisher** on npmjs.com:

1. Go to https://www.npmjs.com/package/@page-use/client/access (and `/react/access`)
2. Under **Publishing access**, click **Add trusted publisher**
3. Fill in:
   - **Repository owner**: `page-use-people`
   - **Repository name**: `page-use`
   - **Workflow filename**: `release.yml`
   - **Environment**: _(leave blank)_
4. Save

After this, GitHub Actions can publish without any secrets or tokens.

## Troubleshooting

### "No changesets found" in the version PR workflow

You merged a PR without a changeset file. Run `pnpm changeset` locally, commit the file, and push to `main`.

### Version PR not appearing

Check that the changeset `.md` file landed in `.changeset/` on the `main` branch. The workflow triggers on changes to `.changeset/**/*.md`.

### Publish failed with 403

The npm trusted publisher isn't configured. Follow the OIDC setup steps above.

### Want to publish manually (emergency)

```sh
pnpm build
pnpm changeset version
pnpm changeset publish
```

You'll need npm credentials configured locally (`npm login`).

# Release Process

This document describes how to release a new version of `js-lean` to the npm registry.

## Prerequisites

- Node.js `>= 20` (see [`.nvmrc`](./.nvmrc))
- A clean working tree on an up-to-date `main` branch
- Conventional commit messages in the Git history
- npm publish rights for the package (`npm whoami` shows your authenticated account)

## Versioning

`js-lean` follows [Semantic Versioning](https://semver.org/), driven by the
[Conventional Commits](https://www.conventionalcommits.org/) in the Git history:

- `fix:` commits → patch bump (0.2.0 → 0.2.1)
- `feat:` commits → minor bump (0.2.0 → 0.3.0)
- `BREAKING CHANGE` in a commit footer → major bump (0.2.0 → 1.0.0)

## Steps

### 1. Run all checks

```bash
npm run check
```

This runs type checking, linting, and the full test suite in one command. Everything must pass before releasing.

### 2. Build the distributable bundle

```bash
npm run build
```

This bundles the CLI to `dist/` with `tsup`. The `prepublishOnly` hook also runs this automatically on `npm publish`.

### 3. Verify the published contents

Preview exactly which files will be included in the published tarball, and confirm no repository artefacts leak in:

```bash
npx js-lean lint
npm pack --dry-run
```

### 4. Bump the version

Pick the bump type that matches the changes since the last release:

```bash
npm version patch   # 0.2.0 → 0.2.1
npm version minor   # 0.2.0 → 0.3.0
npm version major   # 0.2.0 → 1.0.0
```

`npm version` updates `package.json`, creates a commit, and tags it `vX.Y.Z`.

### 5. Push the release

```bash
git push origin main --follow-tags
```

### 6. Publish to npm

```bash
npm publish
```

For a pre-release, publish under a dedicated tag so it is not installed by default:

```bash
npm publish --tag next
```

### 7. Verify the release

```bash
npm view js-lean version
```

Confirm the newly published version matches the tag you created.

### 8. Create a GitHub release

Create a GitHub release from the tag you pushed so the changes are visible on the repository's Releases page:

```bash
gh release create vX.Y.Z --generate-notes
```

The `--generate-notes` flag builds release notes from the Conventional Commits merged since the previous tag. Review and edit them if needed before publishing.

## Troubleshooting

- __`npm publish` fails with `403 Forbidden`__ — confirm you are logged in (`npm whoami`) and have publish rights for the package.
- __Unexpected files in the tarball__ — rerun `npx js-lean lint` and `npm pack --dry-run`, then adjust the `files` allowlist in `package.json`.
- __Tag already exists__ — delete the local and remote tag (`git tag -d vX.Y.Z` and `git push origin :refs/tags/vX.Y.Z`) before re-running `npm version`.

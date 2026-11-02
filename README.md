# js-lean

Validate and manage npm package publishing hygiene to keep published packages lean.

`js-lean` is a JavaScript/TypeScript counterpart to [cargo-lean](https://github.com/lean-packages/cargo-lean) and
[py-lean](https://github.com/lean-packages/py-lean). It audits the publishing configuration in `package.json` (the
`files` allowlist) and an optional `.npmignore` to help prevent repository-only files from unnecessarily ending up in
published package archives.

## Why?

A published npm package can contain more than the files consumers need at runtime. Without deliberate publishing
configuration, repository artefacts such as IDE settings, tests, build configuration, documentation, and CI workflows
may end up in the package archive.

These unnecessary files can increase package size, add noise for downstream users, and expose details of the
development repository that do not need to be part of the published package.

`js-lean` helps keep the `package.json` `files` allowlist focused on runtime files and checks an existing `.npmignore`
for repository artefacts that should be excluded.

Your working repository remains intact: `js-lean` changes publishing configuration, not the files in your project.
It does not delete repository files.

## Features

- __Lint__ — Detect non-runtime entries in `files`, unnecessary repository artefacts referenced in `.npmignore`, and
  stray publishable files.
- __Create__ — Scaffold a default `files` allowlist and a populated `.npmignore`.
- __Update__ — Non-destructively complement `files` and `.npmignore` based on the repository contents.

## Installation

### From source

```bash
git clone https://github.com/lean-packages/js-lean.git && cd js-lean
npm install
npm run build
```

### From npm

```bash
npm install js-lean
```

### Run during development

```bash
# Run from source (no build needed; uses tsx)
npm run dev -- lint

# Run the built CLI
npm start -- lint
```

Alternatively, run it directly without a local installation using npx:

```bash
npx js-lean lint
```

## Usage

```bash
js-lean <command>
```

### Commands

| Command | Description |
| ------- | ----------- |
| `lint`  | Check the publishing hygiene of `package.json` `files` and `.npmignore`. |
| `create` | Scaffold a default `files` allowlist and a populated `.npmignore`. |
| `update` | Complement `files` and `.npmignore` to reflect the repository contents. |

### `lint` — Check publishing hygiene

Checks that the `package.json` `files` allowlist contains runtime files and that an existing `.npmignore` does not
contain unnecessary entries for dotfiles and repository artefacts.

```bash
# Check the current directory
js-lean lint

# Check a specific manifest
js-lean lint --manifest-path /path/to/package.json

# Show a diff of the entries that should be removed
js-lean lint --diff

# JSON output for scripting
js-lean lint --format json

# Enable the stray publishable file check
js-lean lint --enforce-no-strays
```

#### Stray publishable file check

The optional stray-file check flags top-level files whose publishing status is not accounted for by the
`package.json` `files` allowlist or `.npmignore`. For each flagged file, decide whether it belongs in the published
package: add it to `files` if it should be published, or exclude it through `.npmignore` if it should remain
repository-only.

Files that npm always includes (such as `README`, `LICENSE`, and `package.json`), lockfiles, and dotfiles are not
reported by this check. The check is disabled by default. Enable it with `--enforce-no-strays`; when enabled, each
stray is reported as an error and causes `lint` to exit with code `1`.

### `create` — Scaffold publishing configuration

Adds a default `files` allowlist to `package.json` when the field is absent and creates a populated `.npmignore` with
common repository artefacts when the file does not exist. Existing configuration is preserved.

```bash
# Preview what would be created
js-lean create --dry-run

# Apply changes
js-lean create

# JSON output
js-lean create --format json
```

### `update` — Reflect the repository contents

Non-destructively complements the `package.json` `files` field and an existing `.npmignore` with runtime files and
repository artefacts that actually exist on disk. Existing entries are preserved; `update` does not remove entries.

```bash
# Preview what would change
js-lean update --dry-run

# Apply changes
js-lean update

# JSON output
js-lean update --format json
```

### Options and flags

The commands share the following options and flags, aligned with the sibling `cargo-lean` tool:

| Option / Flag | Description |
| ------------- | ----------- |
| `-m, --manifest-path <path>` | Path to `package.json` (default: `package.json`). |
| `--format <format>` | Output format: `text` or `json` (default: `text`). |
| `--dry-run` | Preview changes without modifying files (`create`, `update`). |
| `--diff` | Show a diff-style preview of offending entries (`lint`). |
| `--enforce-no-strays` | Enable the stray publishable file check; strays fail the lint (`lint`). |

When `--manifest-path` is provided, the working directory is derived from the parent directory of the specified
`package.json`. For example, `--manifest-path /path/to/package.json` checks for repository artefacts and `.npmignore`
relative to `/path/to/`.

### Help and version

```bash
js-lean --help      # Show help
js-lean --version   # Print version
```

## CI integration

Run `js-lean lint` in your CI pipeline to check that publishing configuration remains tidy:

```yaml
# Example GitHub Actions step
- name: Check package publishing hygiene
  run: npx js-lean lint
```

A failing check helps catch repository artefacts before a package is published.

For a final view of the files npm would include, you can also inspect the package contents with `npm pack --dry-run`.
`js-lean` audits and manages the publishing configuration; npm's pack output is the authoritative preview of the
resulting package contents.

## AI disclaimer

This package is developed with the assistance of Artificial Intelligence (AI). AI tools are used throughout the
development process, including code generation, documentation, testing, and maintenance.

While reasonable care is taken to review and validate AI-generated contributions, AI-generated code is not inherently
correct, secure, or free of defects. All contributions remain subject to human review and project quality standards.

As with any software, use this package at your own risk. No guarantee is made regarding its fitness for a particular
purpose, and the maintainers assume no liability for damages resulting from its use.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development instructions.

## License

This project is licensed under the MIT license. Please see [LICENSE.md](LICENSE.md) for more details.

## Related projects

- [lean-package-validator](https://github.com/lean-packages/lean-package-validator) — The `PHP` counterpart.
- [cargo-lean](https://github.com/lean-packages/cargo-lean) — The `Rust` counterpart.
- [py-lean](https://github.com/lean-packages/py-lean) — The `Python` counterpart.

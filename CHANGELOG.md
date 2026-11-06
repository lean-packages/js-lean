# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-06

### Fixed

- Case-sensitive file existence checks: On case-insensitive filesystems (e.g., macOS), the `update` command could add
  mis-cased entries to `files` or `.npmignore` (e.g., `src` when the repository actually contains `Src`), because
  `existsSync` matches differently-cased names. File existence is now verified by reading directory entries to ensure
  exact filename matches.

## [0.1.0] - 2026-11-03

### Added

- __`lint` command__: Checks publishing hygiene of the `package.json` `files` allowlist and an optional `.npmignore`, detecting non-runtime entries, unnecessary artefacts, and stray publishable files.
- __`create` command__: Scaffolds a sane default `files` allowlist in `package.json` and a populated `.npmignore`, preserving existing configuration.
- __`update` command__: Non-destructively complements `files` and `.npmignore` to reflect the repository state; nothing is ever removed.
- __`--format json` option__: All commands support JSON output for scripting and interoperability.
- __`--diff` flag__ (`lint` command): Shows a diff-style preview of offending entries that should be removed.
- __`--dry-run` flag__ (`create`/`update` commands): Preview changes without modifying files.
- __`--enforce-no-strays` flag__ (`lint` command): Enables the stray publishable file check, which is disabled by default; when enabled, any stray file is reported as an error and fails the lint.
- __`--manifest-path` / `-m` option__: Specify a custom path to the `package.json` file.

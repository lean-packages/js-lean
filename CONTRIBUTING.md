# Contributing

Thank you for your interest in contributing to `js-lean`.

## Code quality

### Installing dependencies

```bash
git clone https://github.com/lean-packages/js-lean.git && cd js-lean
npm install
```

### Formatting

Format all source code with Prettier:

```bash
npm run format
```

Check formatting without writing changes:

```bash
npm run format:check
```

### Linting

Check for common mistakes and improve the leanness of `js-lean`:

```bash
npm run lint
npm run lint:pkg
```

Automatically fix fixable issues:

```bash
npm run lint:fix
```

### Type checking

Verify the project type-checks without emitting output:

```bash
npm run typecheck
```

### Testing

Run the full test suite:

```bash
npm test
```

Run the tests in watch mode, or with coverage:

```bash
npm run test:watch
npm run test:coverage
```

### All checks

Run all quality checks (type checking, linting, and tests) in one command:

```bash
npm run check
```

This is useful before committing or opening a pull request to ensure everything passes.

## Pull requests

Please open pull requests against the `main` branch from a dedicated feature branch. Use descriptive branch names that
reflect the change, such as:

- `feat/history-command`
- `fix/update`
- `docs/update-readme`

## Commit messages

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages. This keeps the
history readable and enables automated changelog generation. You can inspect the message schema for this project via
`git log --oneline -n 10`.

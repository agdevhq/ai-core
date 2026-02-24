# Releasing Packages

This repository uses Turborepo for build/test tasks and Changesets for versioning and npm publishing.

## Publishable Packages

- `@core-ai/core-ai`
- `@core-ai/openai`
- `@core-ai/anthropic`
- `@core-ai/google-genai`
- `@core-ai/mistral`

These packages are configured as a fixed group in `.changeset/config.json`, so they always share the same version.

## Developer Workflow (PRs)

1. Make your code changes.
2. Add a changeset:

```bash
npm run changeset
```

3. Select the package(s) and bump type (`patch`, `minor`, `major`).
4. Commit both code and the generated `.changeset/*.md` file.

## Release Workflow (maintainer)

1. Validate the repo:

```bash
npm run release:check
```

2. Apply version and changelog updates:

```bash
npm run release:version
```

3. Commit the generated version/changelog changes.
4. Publish:

```bash
npm run release:publish
```

## First-time Publishing Notes

- Ensure you are authenticated to npm:

```bash
npm login
```

- If this is the first release for the scoped packages, keep `publishConfig.access` as `public` (already configured).

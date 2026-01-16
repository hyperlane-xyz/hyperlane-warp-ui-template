# Development Scripts

## link-monorepo.js

Links local Hyperlane monorepo packages for development using `pnpm pack` (creates tarball archives).

### Usage

```bash
# Link specific packages
pnpm link:monorepo sdk utils widgets

# Or use node directly
node scripts/link-monorepo.js sdk utils widgets tron-sdk
```

### What it does

1. **Checks monorepo setup**: Verifies the monorepo exists at `../hyperlane-monorepo`
2. **Builds entire monorepo**: Runs `pnpm build` from the monorepo root to ensure all packages and dependencies are built in the correct order
3. **Packs each package**: Runs `pnpm pack` in each specified package to create a `.tgz` tarball
4. **Updates package.json**: Changes dependency references to `file:../hyperlane-monorepo/typescript/<package>/<tarball>.tgz`
5. **Adds pnpm overrides**: Ensures all references (including transitive dependencies) use the packed versions
6. **Cleans and reinstalls**: Removes `node_modules` and `pnpm-lock.yaml`, then runs `pnpm install`

### Why pnpm pack?

**pnpm pack** creates a tarball (`.tgz` file) that:
- **Contains only published files**: Respects the `files` field in `package.json`, just like npm publish
- **Resolves workspace dependencies**: All `workspace:*` and `catalog:` references are resolved to actual versions
- **No symlinks**: Avoids issues with multiple React instances or module resolution problems
- **Works with any package manager**: The tarball can be used with pnpm, npm, or yarn
- **Fast iteration**: Just `pnpm pack` and `pnpm install` to update

This approach is simpler and more reliable than yalc for monorepos with pnpm catalogs.

### Requirements

- The Hyperlane monorepo must be located at `../hyperlane-monorepo`
- Packages must be in `../hyperlane-monorepo/typescript/<package-name>/`
- No additional global tools required (uses built-in pnpm commands)

### Common packages to link

- `sdk` - @hyperlane-xyz/sdk
- `utils` - @hyperlane-xyz/utils
- `widgets` - @hyperlane-xyz/widgets
- `registry` - @hyperlane-xyz/registry
- `tron-sdk` - @hyperlane-xyz/tron-sdk (unpublished)
- `provider-sdk` - @hyperlane-xyz/provider-sdk

### Development workflow

```bash
# 1. Link packages you want to develop
pnpm link:monorepo sdk utils widgets tron-sdk

# 2. Make changes in ../hyperlane-monorepo/typescript/sdk

# 3. Rebuild the monorepo (or just the package)
cd ../hyperlane-monorepo
pnpm build
# OR just rebuild the specific package:
# cd typescript/sdk && pnpm build

# 4. Re-pack the changed package
cd typescript/sdk
pnpm pack

# 5. Reinstall in your React app
cd ../../../hyperlane-warp-ui-template
pnpm install

# 6. Your React app is now using the updated package!
```

### Quick update workflow

For faster iteration after the initial link:

```bash
# In monorepo package directory
cd ../hyperlane-monorepo/typescript/sdk
pnpm build && pnpm pack && cd - && pnpm install
```

### Unlinking

To clean up packed packages:

```bash
pnpm unlink:monorepo
```

This will:
1. Find all dependencies pointing to packed tarballs
2. Remove pnpm overrides for packed packages
3. Clean `node_modules` and lockfile
4. Run `pnpm install`

Note: You'll need to manually update `package.json` to restore published versions from npm, or the tarballs will remain.

## unlink-monorepo.js

Removes packed packages and cleans up overrides.

### Usage

```bash
pnpm unlink:monorepo
```

### Troubleshooting

If you encounter issues:

1. **Check monorepo location**: Ensure `../hyperlane-monorepo` exists
2. **Build errors**: Make sure the monorepo builds successfully with `cd ../hyperlane-monorepo && pnpm build`
3. **Tarball not found**: The package might not have packed correctly - check for `.tgz` files in the package directory
4. **Install fails**: Try manually deleting `node_modules` and `pnpm-lock.yaml`, then run `pnpm install`
5. **Workspace errors**: Make sure you're running `pnpm build` from the monorepo root first

### Manual commands

```bash
# Pack a single package
cd ../hyperlane-monorepo/typescript/sdk
pnpm pack

# Check what tarballs exist
ls ../hyperlane-monorepo/typescript/sdk/*.tgz

# Manually update package.json to use a packed version
# "dependencies": {
#   "@hyperlane-xyz/sdk": "file:../hyperlane-monorepo/typescript/sdk/hyperlane-xyz-sdk-21.1.0.tgz"
# }

# Force reinstall
rm -rf node_modules pnpm-lock.yaml && pnpm install
```

### Notes

- Tarballs are created in the package directory (e.g., `typescript/sdk/hyperlane-xyz-sdk-21.1.0.tgz`)
- The script automatically cleans old tarballs before packing
- After linking, your `package.json` will have `file:../hyperlane-monorepo/...` references
- Tarballs contain only files listed in the package's `files` field (typically just `/dist`)
- This approach works great for development but remember to test with published versions before releasing

### Comparison: pnpm pack vs yalc

| Feature | pnpm pack | yalc |
|---------|-----------|------|
| Setup | No global tools | Requires global install |
| Catalog support | ✅ Native | ⚠️ Needs @jimsheen/yalc fork |
| Speed | Fast | Fast |
| Workflow | pack + install | publish + push |
| Cleanup | Delete tarballs | yalc remove |
| Portability | Works anywhere | Requires yalc on system |

For this monorepo with pnpm catalogs, `pnpm pack` is the recommended approach.

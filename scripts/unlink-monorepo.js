const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

/**
 * Unlink monorepo packages and restore published versions
 */

const REACT_APP_DIR = process.cwd();
const packageJsonPath = path.join(REACT_APP_DIR, 'package.json');
const workspacePath = path.join(REACT_APP_DIR, 'pnpm-workspace.yaml');
const LOCAL_TARBALLS_DIR = path.join(REACT_APP_DIR, '.monorepo-tarballs');

function isPackedTarballRef(value) {
  return (
    typeof value === 'string' &&
    (value.startsWith('file:../hyperlane-monorepo/') || value.startsWith('file:.monorepo-tarballs/'))
  );
}

console.log('🔗 Unlinking monorepo packages...\n');

try {
  // Read package.json to find file: references to monorepo
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packOverrides = [];

  // Find dependencies pointing to packed tarballs (old or new location)
  if (packageJson.dependencies) {
    Object.entries(packageJson.dependencies).forEach(([name, value]) => {
      if (isPackedTarballRef(value)) {
        packOverrides.push(name);
      }
    });
  }

  if (packOverrides.length === 0) {
    console.log('ℹ️  No packed monorepo packages found in dependencies.');
  } else {
    console.log('🔧 Found packed packages in dependencies:');
    packOverrides.forEach((name) => {
      console.log(`   - ${name}`);
    });
  }

  // Remove overrides for packed packages (old or new location)
  if (packageJson.pnpm && packageJson.pnpm.overrides) {
    let removedCount = 0;
    Object.keys(packageJson.pnpm.overrides).forEach((name) => {
      if (isPackedTarballRef(packageJson.pnpm.overrides[name])) {
        delete packageJson.pnpm.overrides[name];
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`\n🔧 Removed ${removedCount} override(s) from package.json`);
    }
  }

  // Remove matching overrides from pnpm-workspace.yaml. Scanned independently of
  // packOverrides above — link-monorepo.js may only add an override-only entry here
  // (no package.json dependency) for packages that weren't originally direct deps.
  // Mutated in memory only here; written alongside package.json below, after the
  // restoration failure check, so a failed restore never leaves the workspace file
  // stripped while package.json still points at the (soon-to-be-deleted) tarballs.
  let workspaceDoc = null;
  let removedWorkspaceCount = 0;
  if (fs.existsSync(workspacePath)) {
    workspaceDoc = YAML.parseDocument(fs.readFileSync(workspacePath, 'utf8'));
    const overridesNode = workspaceDoc.get('overrides');
    if (YAML.isMap(overridesNode)) {
      overridesNode.items
        .map((item) => item.key.value)
        .forEach((name) => {
          if (isPackedTarballRef(workspaceDoc.getIn(['overrides', name]))) {
            workspaceDoc.deleteIn(['overrides', name]);
            removedWorkspaceCount++;
          }
        });
    }
  }

  // Restore dependencies to published versions
  const failedToRestore = [];
  if (packOverrides.length > 0) {
    console.log('\n🔧 Restoring dependencies to published versions...');

    packOverrides.forEach((name) => {
      if (packageJson.dependencies[name]) {
        const currentValue = packageJson.dependencies[name];
        try {
          // Fetch the latest version from npm registry
          // Use spawnSync with array args to prevent command injection
          const result = spawnSync('npm', ['view', name, 'version'], { encoding: 'utf8' });
          if (result.status === 0 && result.stdout) {
            const versionOutput = result.stdout.trim();
            packageJson.dependencies[name] = versionOutput;
            console.log(`   ${name} -> ${versionOutput}`);
          } else {
            console.warn(`   ⚠️  Failed to fetch version for ${name}`);
            failedToRestore.push({ name, currentValue });
          }
        } catch (err) {
          console.warn(`   ⚠️  Failed to fetch version for ${name}`);
          failedToRestore.push({ name, currentValue });
        }
      }
    });
  }

  // Check if any dependencies couldn't be restored
  if (failedToRestore.length > 0) {
    console.error('\n❌ Cannot proceed: Some dependencies could not be restored to published versions.');
    console.error('   This typically happens with unpublished packages (e.g., @hyperlane-xyz/tron-sdk)');
    console.error('   or when you are offline.\n');
    console.error('   Failed packages:');
    failedToRestore.forEach(({ name, currentValue }) => {
      console.error(`   - ${name} (currently: ${currentValue})`);
    });
    console.error('\n💡 Options:');
    console.error('   1. Manually update these dependencies in package.json to published versions');
    console.error('   2. Remove these dependencies from package.json if not needed');
    console.error('   3. Keep using the linked versions (do not run this script)\n');
    process.exit(1);
  }

  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  if (removedWorkspaceCount > 0) {
    fs.writeFileSync(workspacePath, String(workspaceDoc));
    console.log(`🔧 Removed ${removedWorkspaceCount} override(s) from pnpm-workspace.yaml`);
  }

  console.log('\n------------------------------------------');
  console.log('🧹 Cleaning node_modules, lockfile, and tarballs...\n');

  const nodeModulesPath = path.join(REACT_APP_DIR, 'node_modules');
  const lockfilePath = path.join(REACT_APP_DIR, 'pnpm-lock.yaml');

  if (fs.existsSync(nodeModulesPath)) {
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  }
  if (fs.existsSync(lockfilePath)) {
    fs.unlinkSync(lockfilePath);
  }

  // Clean up local tarballs directory
  if (fs.existsSync(LOCAL_TARBALLS_DIR)) {
    console.log(`   Removing ${path.relative(REACT_APP_DIR, LOCAL_TARBALLS_DIR)}/`);
    fs.rmSync(LOCAL_TARBALLS_DIR, { recursive: true, force: true });
  }

  console.log('✅ Cleaned\n');

  console.log('------------------------------------------');
  console.log('📥 Running pnpm install...\n');

  execSync('pnpm install', {
    stdio: 'inherit'
  });

  console.log('\n✅ Successfully unlinked packages!');
  console.log('   All dependencies have been restored to their published versions from npm.\n');
} catch (err) {
  console.error('\n❌ Unlink failed. See error above.\n');
  process.exit(1);
}

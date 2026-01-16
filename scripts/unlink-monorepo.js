const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Unlink monorepo packages and restore published versions
 */

const REACT_APP_DIR = process.cwd();
const packageJsonPath = path.join(REACT_APP_DIR, 'package.json');
const LOCAL_TARBALLS_DIR = path.join(REACT_APP_DIR, '.monorepo-tarballs');

console.log('🔗 Unlinking monorepo packages...\n');

try {
  // Read package.json to find file: references to monorepo
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packOverrides = [];

  // Find dependencies pointing to packed tarballs (old or new location)
  if (packageJson.dependencies) {
    Object.entries(packageJson.dependencies).forEach(([name, value]) => {
      if (typeof value === 'string' &&
          (value.startsWith('file:../hyperlane-monorepo/') ||
           value.startsWith('file:.monorepo-tarballs/'))) {
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
      const value = packageJson.pnpm.overrides[name];
      if (typeof value === 'string' &&
          (value.startsWith('file:../hyperlane-monorepo/') ||
           value.startsWith('file:.monorepo-tarballs/'))) {
        delete packageJson.pnpm.overrides[name];
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`\n🔧 Removed ${removedCount} override(s) from package.json`);
    }
  }

  // For dependencies, we'll prompt user to restore them manually or keep registry versions
  if (packOverrides.length > 0) {
    console.log('\n⚠️  WARNING: The following dependencies still point to packed tarballs:');
    packOverrides.forEach((name) => {
      console.log(`   - ${name}`);
    });
    console.log('\nTo restore published versions, either:');
    console.log('   1. Manually edit package.json to use version numbers (e.g., "23.10.0")');
    console.log('   2. Or delete the dependency lines and run: pnpm add <package-name>');
    console.log('\nFor now, keeping the file: references. You can still install.\n');
  }

  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

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
  console.log('   Note: If you want to use published versions from npm,');
  console.log('   update package.json dependencies to use version numbers.\n');
} catch (err) {
  console.error('\n❌ Unlink failed. See error above.\n');
  process.exit(1);
}

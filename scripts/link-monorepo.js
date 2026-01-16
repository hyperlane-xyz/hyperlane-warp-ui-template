const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** --- Configuration --- */
const MONOREPO_NAME = 'hyperlane-monorepo';
const REACT_APP_DIR = process.cwd();
const MONOREPO_PATH = path.resolve(REACT_APP_DIR, '..', MONOREPO_NAME);
const LOCAL_TARBALLS_DIR = path.join(REACT_APP_DIR, '.monorepo-tarballs');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Please specify package folders (e.g., utils sdk widgets)');
  process.exit(1);
}

/**
 * Helper to run commands
 */
function run(command, cwd = REACT_APP_DIR) {
  try {
    execSync(command, { stdio: 'inherit', cwd });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Helper to run commands and capture output
 */
function runSilent(command, cwd = REACT_APP_DIR) {
  try {
    return execSync(command, { cwd, encoding: 'utf8' }).trim();
  } catch (err) {
    return null;
  }
}

console.log('🚀 Starting pnpm pack link workflow...\n');

/**
 * 1. Check monorepo setup
 */
console.log('------------------------------------------');
console.log('📋 Checking monorepo setup...');
if (!fs.existsSync(MONOREPO_PATH)) {
  console.error(`❌ Monorepo not found at: ${MONOREPO_PATH}`);
  process.exit(1);
}
console.log(`✅ Found monorepo at: ${MONOREPO_PATH}\n`);

/**
 * 2. Build the entire monorepo first
 */
console.log('------------------------------------------');
console.log('🏗️  Building entire monorepo...');
console.log('   This ensures all dependencies are built in the correct order\n');
if (!run('pnpm build', MONOREPO_PATH)) {
  console.error('\n❌ Monorepo build failed. Please fix errors and try again.');
  process.exit(1);
}
console.log('✅ Monorepo build complete\n');

/**
 * 3. Prepare local tarballs directory
 */
console.log('------------------------------------------');
console.log('📁 Preparing local tarballs directory...\n');

if (!fs.existsSync(LOCAL_TARBALLS_DIR)) {
  fs.mkdirSync(LOCAL_TARBALLS_DIR, { recursive: true });
  console.log(`   ✅ Created: ${LOCAL_TARBALLS_DIR}\n`);
} else {
  console.log(`   ✅ Using: ${LOCAL_TARBALLS_DIR}\n`);
}

/**
 * 4. Pack each specified package
 */
const packedPackages = [];

console.log('------------------------------------------');
console.log('📦 Packing packages...\n');

args.forEach((folder) => {
  const pkgPath = path.join(MONOREPO_PATH, 'typescript', folder);
  if (!fs.existsSync(pkgPath)) {
    console.warn(`⚠️  Folder not found: ${pkgPath}`);
    return;
  }

  const pkgJsonPath = path.join(pkgPath, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const packageName = pkgJson.name;
  const packageVersion = pkgJson.version;

  console.log(`📦 Packing: ${packageName}@${packageVersion}`);

  // Remove old tarballs first
  const oldTarballs = fs.readdirSync(pkgPath).filter(f => f.endsWith('.tgz'));
  oldTarballs.forEach(tarball => {
    fs.unlinkSync(path.join(pkgPath, tarball));
  });

  // Pack the package
  if (!run('pnpm pack', pkgPath)) {
    console.error(`❌ Failed to pack ${packageName}`);
    return;
  }

  // Find the generated tarball
  const tarballs = fs.readdirSync(pkgPath).filter(f => f.endsWith('.tgz'));
  if (tarballs.length === 0) {
    console.error(`❌ No tarball found for ${packageName}`);
    return;
  }

  const tarballName = tarballs[0];
  const sourceTarballPath = path.join(pkgPath, tarballName);
  const destTarballPath = path.join(LOCAL_TARBALLS_DIR, tarballName);

  // Move tarball from monorepo to local directory
  fs.copyFileSync(sourceTarballPath, destTarballPath);
  fs.unlinkSync(sourceTarballPath);

  const relativePath = path.relative(REACT_APP_DIR, destTarballPath);

  packedPackages.push({
    name: packageName,
    version: packageVersion,
    tarballPath: relativePath,
  });

  console.log(`   ✅ Created and moved: ${tarballName}`);
  console.log(`      Location: ${relativePath}\n`);
});

if (packedPackages.length === 0) {
  console.error('❌ No packages were packed successfully.');
  process.exit(1);
}

/**
 * 5. Update package.json with file: references
 */
console.log('------------------------------------------');
console.log('🔧 Updating package.json with packed dependencies...\n');

const packageJsonPath = path.join(REACT_APP_DIR, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Ensure pnpm.overrides exists
if (!packageJson.pnpm) {
  packageJson.pnpm = {};
}
if (!packageJson.pnpm.overrides) {
  packageJson.pnpm.overrides = {};
}

packedPackages.forEach(({ name, tarballPath }) => {
  // Update dependencies
  if (packageJson.dependencies && packageJson.dependencies[name]) {
    packageJson.dependencies[name] = `file:${tarballPath}`;
    console.log(`   ${name} -> file:${tarballPath}`);
  }

  // Add to overrides to ensure sub-dependencies use packed version
  packageJson.pnpm.overrides[name] = `file:${tarballPath}`;
});

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('\n✅ Updated package.json\n');

/**
 * 6. Clean and reinstall
 */
console.log('------------------------------------------');
console.log('🧹 Cleaning node_modules and lockfile...\n');

const nodeModulesPath = path.join(REACT_APP_DIR, 'node_modules');
const lockfilePath = path.join(REACT_APP_DIR, 'pnpm-lock.yaml');

if (fs.existsSync(nodeModulesPath)) {
  fs.rmSync(nodeModulesPath, { recursive: true, force: true });
}
if (fs.existsSync(lockfilePath)) {
  fs.unlinkSync(lockfilePath);
}

console.log('✅ Cleaned\n');

console.log('------------------------------------------');
console.log('📥 Installing dependencies...\n');

if (!run('pnpm install')) {
  console.error('\n❌ pnpm install failed.');
  process.exit(1);
}

/**
 * 7. Success!
 */
console.log('\n------------------------------------------');
console.log('✨ Done! Packages are linked.\n');
console.log('📦 Linked packages:');
packedPackages.forEach(({ name, version }) => {
  console.log(`   - ${name}@${version}`);
});
console.log('\n💡 To update after making changes:');
console.log('   1. Run this script again: pnpm link:monorepo <packages>');
console.log('   OR manually:');
console.log('   1. cd ../hyperlane-monorepo && pnpm build');
console.log('   2. cd typescript/<package> && pnpm pack');
console.log('   3. Move the .tgz file to .monorepo-tarballs/ here');
console.log('   4. cd back here && pnpm install\n');
console.log(`📁 Tarballs location: ${path.relative(REACT_APP_DIR, LOCAL_TARBALLS_DIR)}\n`);

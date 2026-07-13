const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
const arch = os.arch();

// Determine binary name based on platform
let binaryName;
if (platform === 'win32') {
  binaryName = 'devdesk-scan.exe';
} else {
  binaryName = 'devdesk-scan';
}

// Use process.cwd() since this script is run via npm from the devdesk-engine directory
const sourcePath = path.join(process.cwd(), 'rust', 'target', 'release', binaryName);
const distDir = path.join(process.cwd(), 'dist');
const destPath = path.join(distDir, binaryName);

console.log('Platform:', platform);
console.log('Binary name:', binaryName);
console.log('Source path:', sourcePath);
console.log('Dest path:', destPath);

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy binary
if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied ${binaryName} to dist/`);
  process.exit(0);
} else {
  console.error(`Binary not found: ${sourcePath}`);
  process.exit(1);
}

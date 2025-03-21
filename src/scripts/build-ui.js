/**
 * Frontend build script
 * This script is a wrapper around Vite's build command.
 * It ensures the UI is built with the correct configuration.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths
const rootDir = path.resolve(__dirname, '../..');
const distDir = path.resolve(rootDir, 'dist');
const uiDistDir = path.resolve(distDir, 'ui');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('Building frontend using Vite...');

try {
  // Run Vite build
  execSync('npx vite build', {
    cwd: rootDir,
    stdio: 'inherit',
  });
  
  console.log('Frontend built successfully.');
  
  // Verify build output
  if (fs.existsSync(uiDistDir) && fs.existsSync(path.join(uiDistDir, 'index.html'))) {
    console.log(`UI files available at ${uiDistDir}`);
  } else {
    console.error('Something went wrong. UI files not found in expected location.');
    process.exit(1);
  }
} catch (error) {
  console.error('Error building frontend:', error);
  process.exit(1);
}
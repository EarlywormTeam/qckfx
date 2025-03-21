/**
 * This script initializes basic shadcn/ui components
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure components.json exists
const componentsConfigPath = path.resolve(__dirname, '../../components.json');
if (!fs.existsSync(componentsConfigPath)) {
  console.error('components.json not found. Please run setup first.');
  process.exit(1);
}

console.log('Installing base UI components...');

// List of basic components to install
const components = [
  'button',
  'card',
  'input',
  'textarea',
  'label',
  'dialog',
  'toast',
  'tooltip',
  'dropdown-menu',
];

// Install each component
components.forEach(component => {
  try {
    console.log(`Adding ${component}...`);
    execSync(`npm run ui:generate ${component}`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error(`Error installing ${component}:`, error);
  }
});

console.log('Base UI components installed successfully.');
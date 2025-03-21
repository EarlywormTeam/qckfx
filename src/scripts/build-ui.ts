/**
 * Frontend build script
 * This script builds a placeholder UI until we have an actual frontend implementation.
 * It's designed to run as part of the npm build process.
 */

import * as fs from 'fs';
import * as path from 'path';

// Ensure dist directory exists
const distDir = path.resolve(__dirname, '../../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create UI directory
const uiDir = path.resolve(distDir, 'ui');
if (!fs.existsSync(uiDir)) {
  fs.mkdirSync(uiDir, { recursive: true });
}

// Create a simple placeholder index.html
console.log('Building placeholder UI...');
const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Web UI</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #1e1e1e;
      color: #e0e0e0;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      text-align: center;
    }
    .container {
      max-width: 800px;
      padding: 20px;
    }
    h1 {
      color: #61dafb;
    }
    pre {
      background-color: #2d2d2d;
      padding: 15px;
      border-radius: 5px;
      overflow: auto;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Agent Web UI</h1>
    <p>The full Web UI will be available in a future update.</p>
    <pre>
$ qckfx --help
    </pre>
  </div>
</body>
</html>
`;

// Write the index.html file
fs.writeFileSync(path.join(uiDir, 'index.html'), indexHtml.trim());
console.log('Placeholder UI built successfully.');
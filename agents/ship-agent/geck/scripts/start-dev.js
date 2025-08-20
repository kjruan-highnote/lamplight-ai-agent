#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function formatLog(prefix, color, message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  return `${colors.dim}[${timestamp}]${colors.reset} ${color}[${prefix}]${colors.reset} ${message}`;
}

function startProcess(command, args, prefix, color, envVars = {}) {
  const proc = spawn(command, args, {
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1', ...envVars }
  });

  // Handle stdout
  const rlOut = readline.createInterface({
    input: proc.stdout,
    crlfDelay: Infinity
  });

  rlOut.on('line', (line) => {
    console.log(formatLog(prefix, color, line));
  });

  // Handle stderr
  const rlErr = readline.createInterface({
    input: proc.stderr,
    crlfDelay: Infinity
  });

  rlErr.on('line', (line) => {
    // Check if it's an actual error or just a warning
    if (line.includes('ERROR') || line.includes('Error') || line.includes('failed')) {
      console.error(formatLog(prefix, colors.red, line));
    } else if (line.includes('warning') || line.includes('Warning')) {
      console.warn(formatLog(prefix, colors.yellow, line));
    } else {
      console.log(formatLog(prefix, color, line));
    }
  });

  proc.on('error', (error) => {
    console.error(formatLog(prefix, colors.red, `Failed to start process: ${error.message}`));
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(formatLog(prefix, colors.red, `Process exited with code ${code}`));
    }
  });

  return proc;
}

console.log(`
${colors.bright}${colors.green}╔════════════════════════════════════════╗
║         GECK Development Server        ║
║     Garden of Eden Creation Kit        ║
╚════════════════════════════════════════╝${colors.reset}

${colors.cyan}Starting development servers...${colors.reset}
`);

// Start the React app
const reactApp = startProcess('npm', ['run', 'start:app'], 'REACT', colors.cyan);

// Start Netlify Functions with NODE_ENV=development
const netlifyFunctions = startProcess('netlify', ['functions:serve', '--port', '9000'], 'FUNCTIONS', colors.magenta, { NODE_ENV: 'development' });

console.log(`
${colors.green}✓${colors.reset} React App:        ${colors.bright}http://localhost:3000${colors.reset}
${colors.green}✓${colors.reset} Netlify Functions: ${colors.bright}http://localhost:9000/.netlify/functions${colors.reset}
${colors.green}✓${colors.reset} MongoDB:          ${colors.bright}${process.env.MONGODB_URI || 'Not configured'}${colors.reset}

${colors.yellow}Press Ctrl+C to stop all servers${colors.reset}
`);

// Handle process termination
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down development servers...${colors.reset}`);
  
  reactApp.kill('SIGTERM');
  netlifyFunctions.kill('SIGTERM');
  
  setTimeout(() => {
    console.log(`${colors.green}✓ All servers stopped${colors.reset}`);
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  reactApp.kill('SIGTERM');
  netlifyFunctions.kill('SIGTERM');
  process.exit(0);
});
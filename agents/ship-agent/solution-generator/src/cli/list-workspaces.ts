#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';

const API_KEY = process.env.POSTMAN_API_KEY || 'YOUR_POSTMAN_API_KEY';

async function listWorkspaces() {
  try {
    console.log(chalk.cyan('\n🔍 Fetching your Postman workspaces...\n'));
    
    const response = await axios.get('https://api.getpostman.com/workspaces', {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    const workspaces = response.data.workspaces || [];
    
    if (workspaces.length === 0) {
      console.log(chalk.yellow('No workspaces found'));
      return;
    }
    
    console.log(chalk.green(`Found ${workspaces.length} workspace(s):\n`));
    
    workspaces.forEach((workspace: any, index: number) => {
      console.log(chalk.blue(`${index + 1}. ${workspace.name}`));
      console.log(`   ID: ${chalk.yellow(workspace.id)}`);
      console.log(`   Type: ${workspace.type}`);
      console.log('');
    });
    
    console.log(chalk.gray('\nUse one of the workspace IDs above for syncing collections'));
    
  } catch (error: any) {
    console.error(chalk.red('Error fetching workspaces:'));
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Message: ${error.response.data?.error?.message || error.response.statusText}`);
    } else {
      console.error(`  ${error.message}`);
    }
  }
}

listWorkspaces();
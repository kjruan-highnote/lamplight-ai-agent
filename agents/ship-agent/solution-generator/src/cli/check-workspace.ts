#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';

const API_KEY = process.env.POSTMAN_API_KEY || 'YOUR_POSTMAN_API_KEY';
const WORKSPACE_ID = process.argv[2] || 'dca6e8ba-6bac-43b7-b246-385f1134f2aa';

async function checkWorkspace() {
  try {
    console.log(chalk.cyan(`\n📚 Checking collections in workspace...\n`));
    
    const response = await axios.get(`https://api.getpostman.com/workspaces/${WORKSPACE_ID}`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    const workspace = response.data.workspace;
    console.log(chalk.green(`Workspace: ${workspace.name}\n`));
    
    const collections = workspace.collections || [];
    
    if (collections.length === 0) {
      console.log(chalk.yellow('No collections found in this workspace'));
      return;
    }
    
    console.log(chalk.blue(`Found ${collections.length} collection(s):\n`));
    
    collections.forEach((collection: any, index: number) => {
      console.log(`${index + 1}. ${chalk.green(collection.name)}`);
      console.log(`   ID: ${chalk.gray(collection.uid)}`);
    });
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.response?.data || error.message);
  }
}

checkWorkspace();
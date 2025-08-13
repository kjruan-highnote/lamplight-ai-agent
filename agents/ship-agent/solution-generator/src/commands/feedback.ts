import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { FeedbackWorkflow } from '../feedback/FeedbackWorkflow.js';
import { FeedbackAnalyzer } from '../feedback/FeedbackAnalyzer.js';

export function createFeedbackCommand(): Command {
  const feedback = new Command('feedback')
    .description('Manage customer feedback and document iterations');

  // Start a feedback session
  feedback
    .command('start')
    .description('Start a feedback session for a generated document')
    .requiredOption('-d, --document <path>', 'Path to the generated document')
    .requiredOption('-p, --program <type>', 'Program type (e.g., ap_automation)')
    .requiredOption('-c, --customer <name>', 'Customer name (e.g., trip_com)')
    .option('--branch <name>', 'Git branch for tracking', 'feedback')
    .action(async (options) => {
      const spinner = ora('Starting feedback session...').start();
      
      try {
        const workflow = new FeedbackWorkflow('../data', {
          autoCommit: true,
          autoRegenerate: false,
          requireApproval: true,
          trackingBranch: options.branch
        });

        const sessionId = await workflow.startFeedbackSession(
          options.document,
          options.program,
          options.customer
        );

        spinner.succeed(chalk.green('✅ Feedback session started'));
        console.log(chalk.cyan('\n📋 Session Details:'));
        console.log(`  Session ID: ${chalk.yellow(sessionId)}`);
        console.log(`  Document: ${chalk.blue(options.document)}`);
        console.log(`  Branch: ${chalk.magenta(options.branch + '/' + sessionId)}`);
        console.log(chalk.gray('\n💡 Edit the document and run "feedback process" to analyze changes'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to start feedback session'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Process feedback on edited document
  feedback
    .command('process')
    .description('Process feedback from an edited document')
    .requiredOption('-s, --session <id>', 'Feedback session ID')
    .requiredOption('-d, --document <path>', 'Path to the edited document')
    .option('--auto-apply', 'Automatically apply high-confidence suggestions')
    .option('--regenerate', 'Regenerate solution after applying feedback')
    .action(async (options) => {
      const spinner = ora('Processing feedback...').start();
      
      try {
        const workflow = new FeedbackWorkflow('../data', {
          autoCommit: true,
          autoRegenerate: options.regenerate || false,
          requireApproval: !options.autoApply,
          trackingBranch: 'feedback'
        });

        await workflow.processFeedback(options.session, options.document);
        
        spinner.succeed(chalk.green('✅ Feedback processed successfully'));
        
        if (options.regenerate) {
          console.log(chalk.cyan('🔄 Solution regenerated with feedback'));
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to process feedback'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Analyze changes in a document
  feedback
    .command('analyze')
    .description('Analyze changes in an edited document')
    .requiredOption('-d, --document <path>', 'Path to the edited document')
    .option('--output <path>', 'Output path for analysis report')
    .action(async (options) => {
      const spinner = ora('Analyzing changes...').start();
      
      try {
        const analyzer = new FeedbackAnalyzer('../data');
        const reportPath = await analyzer.generateDiffReport(options.document);
        
        spinner.succeed(chalk.green('✅ Analysis complete'));
        console.log(chalk.cyan('\n📊 Analysis Report:'));
        
        // Read and display summary
        const report = await fs.readFile(reportPath, 'utf-8');
        const lines = report.split('\n');
        const summary = lines.slice(0, 15).join('\n');
        console.log(summary);
        
        console.log(chalk.gray(`\nFull report: ${reportPath}`));
        
        if (options.output) {
          await fs.copy(reportPath, options.output);
          console.log(chalk.green(`Report saved to: ${options.output}`));
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to analyze document'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Complete a feedback session
  feedback
    .command('complete')
    .description('Complete a feedback session and merge changes')
    .requiredOption('-s, --session <id>', 'Feedback session ID')
    .option('--no-merge', 'Skip git merge to main branch')
    .action(async (options) => {
      const spinner = ora('Completing feedback session...').start();
      
      try {
        const workflow = new FeedbackWorkflow('../data');
        await workflow.completeFeedbackSession(options.session);
        
        spinner.succeed(chalk.green('✅ Feedback session completed'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to complete session'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // List feedback sessions
  feedback
    .command('list')
    .description('List all feedback sessions')
    .option('--active', 'Show only active sessions')
    .option('--completed', 'Show only completed sessions')
    .action(async (options) => {
      try {
        const workflow = new FeedbackWorkflow('../data');
        const sessions = await workflow.listSessions();
        
        let filtered = sessions;
        if (options.active) {
          filtered = sessions.filter(s => s.status === 'active');
        } else if (options.completed) {
          filtered = sessions.filter(s => s.status === 'completed');
        }
        
        if (filtered.length === 0) {
          console.log(chalk.yellow('No feedback sessions found'));
          return;
        }
        
        console.log(chalk.cyan('\n📋 Feedback Sessions:\n'));
        console.log(chalk.gray('ID'.padEnd(20) + 'Status'.padEnd(12) + 'Document'.padEnd(40) + 'Changes'));
        console.log(chalk.gray('-'.repeat(80)));
        
        filtered.forEach(session => {
          const totalChanges = session.changes.reduce((sum, r) => sum + r.changes.length, 0);
          const status = session.status === 'active' 
            ? chalk.green(session.status) 
            : chalk.gray(session.status);
          
          console.log(
            session.sessionId.substring(8, 28).padEnd(20) +
            status.padEnd(20) +
            path.basename(session.documentPath).padEnd(40) +
            totalChanges
          );
        });
      } catch (error) {
        console.error(chalk.red('Failed to list sessions'));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Interactive feedback workflow
  feedback
    .command('interactive')
    .description('Start an interactive feedback workflow')
    .action(async () => {
      try {
        const workflow = new FeedbackWorkflow('../data');
        
        // Choose action
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '🚀 Start new feedback session', value: 'start' },
              { name: '📝 Process feedback on edited document', value: 'process' },
              { name: '📊 Analyze document changes', value: 'analyze' },
              { name: '✅ Complete feedback session', value: 'complete' },
              { name: '📋 View session history', value: 'history' }
            ]
          }
        ]);

        switch (action) {
          case 'start':
            await startInteractiveSession(workflow);
            break;
          case 'process':
            await processInteractiveFeedback(workflow);
            break;
          case 'analyze':
            await analyzeInteractive();
            break;
          case 'complete':
            await completeInteractiveSession(workflow);
            break;
          case 'history':
            await viewHistory(workflow);
            break;
        }
      } catch (error) {
        console.error(chalk.red('Error in interactive workflow:'), error.message);
        process.exit(1);
      }
    });

  return feedback;
}

// Interactive helper functions
async function startInteractiveSession(workflow: FeedbackWorkflow) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'document',
      message: 'Path to generated document:',
      validate: (input) => fs.pathExistsSync(input) || 'File does not exist'
    },
    {
      type: 'input',
      name: 'program',
      message: 'Program type:',
      default: 'ap_automation'
    },
    {
      type: 'input',
      name: 'customer',
      message: 'Customer name:',
      default: 'trip_com'
    }
  ]);

  const sessionId = await workflow.startFeedbackSession(
    answers.document,
    answers.program,
    answers.customer
  );

  console.log(chalk.green(`\n✅ Session started: ${sessionId}`));
  console.log(chalk.cyan('You can now edit the document and run feedback process'));
}

async function processInteractiveFeedback(workflow: FeedbackWorkflow) {
  const sessions = await workflow.listSessions();
  const activeSessions = sessions.filter(s => s.status === 'active');
  
  if (activeSessions.length === 0) {
    console.log(chalk.yellow('No active sessions found'));
    return;
  }

  const { sessionId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sessionId',
      message: 'Select session:',
      choices: activeSessions.map(s => ({
        name: `${s.sessionId.substring(8, 20)} - ${path.basename(s.documentPath)}`,
        value: s.sessionId
      }))
    }
  ]);

  const { documentPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'documentPath',
      message: 'Path to edited document:',
      validate: (input) => fs.pathExistsSync(input) || 'File does not exist'
    }
  ]);

  await workflow.processFeedback(sessionId, documentPath);
  console.log(chalk.green('\n✅ Feedback processed successfully'));
}

async function analyzeInteractive() {
  const { documentPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'documentPath',
      message: 'Path to edited document:',
      validate: (input) => fs.pathExistsSync(input) || 'File does not exist'
    }
  ]);

  const analyzer = new FeedbackAnalyzer('../data');
  const reportPath = await analyzer.generateDiffReport(documentPath);
  
  console.log(chalk.green(`\n✅ Analysis complete: ${reportPath}`));
  
  const { viewReport } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'viewReport',
      message: 'View report now?',
      default: true
    }
  ]);

  if (viewReport) {
    const report = await fs.readFile(reportPath, 'utf-8');
    console.log('\n' + report);
  }
}

async function completeInteractiveSession(workflow: FeedbackWorkflow) {
  const sessions = await workflow.listSessions();
  const activeSessions = sessions.filter(s => s.status === 'active');
  
  if (activeSessions.length === 0) {
    console.log(chalk.yellow('No active sessions found'));
    return;
  }

  const { sessionId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sessionId',
      message: 'Select session to complete:',
      choices: activeSessions.map(s => ({
        name: `${s.sessionId.substring(8, 20)} - ${path.basename(s.documentPath)}`,
        value: s.sessionId
      }))
    }
  ]);

  await workflow.completeFeedbackSession(sessionId);
  console.log(chalk.green('\n✅ Session completed successfully'));
}

async function viewHistory(workflow: FeedbackWorkflow) {
  const sessions = await workflow.listSessions();
  
  if (sessions.length === 0) {
    console.log(chalk.yellow('No feedback sessions found'));
    return;
  }

  console.log(chalk.cyan('\n📊 Feedback Session History:\n'));
  
  sessions.forEach(session => {
    const totalChanges = session.changes.reduce((sum, r) => sum + r.changes.length, 0);
    console.log(chalk.yellow(`\nSession: ${session.sessionId.substring(8, 20)}`));
    console.log(`  Status: ${session.status === 'active' ? chalk.green(session.status) : chalk.gray(session.status)}`);
    console.log(`  Document: ${path.basename(session.documentPath)}`);
    console.log(`  Iterations: ${session.iterations}`);
    console.log(`  Total Changes: ${totalChanges}`);
    console.log(`  Started: ${new Date(session.startTime).toLocaleString()}`);
    console.log(`  Last Update: ${new Date(session.lastUpdate).toLocaleString()}`);
  });
}
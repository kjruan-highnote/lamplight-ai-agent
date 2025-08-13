import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { FeedbackAnalyzer } from './FeedbackAnalyzer.js';
import { SolutionGenerator } from '../generators/SolutionGenerator.js';
import { HTMLExporter } from '../exporters/HTMLExporter.js';
import { simpleGit, SimpleGit } from 'simple-git';

interface WorkflowConfig {
  autoCommit: boolean;
  autoRegenerate: boolean;
  requireApproval: boolean;
  trackingBranch?: string;
}

interface FeedbackSession {
  sessionId: string;
  documentPath: string;
  originalVersion: string;
  iterations: number;
  status: 'active' | 'completed' | 'abandoned';
  startTime: Date;
  lastUpdate: Date;
  changes: any[];
}

export class FeedbackWorkflow {
  private analyzer: FeedbackAnalyzer;
  private generator: SolutionGenerator;
  private git: SimpleGit;
  private sessionsDir: string;
  private config: WorkflowConfig;

  constructor(
    dataPath: string = '../data',
    config: WorkflowConfig = {
      autoCommit: true,
      autoRegenerate: true,
      requireApproval: false,
      trackingBranch: 'feedback'
    }
  ) {
    this.analyzer = new FeedbackAnalyzer(dataPath);
    this.generator = new SolutionGenerator(dataPath);
    this.git = simpleGit(path.resolve(dataPath));
    this.sessionsDir = path.join(dataPath, 'feedback-sessions');
    this.config = config;
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.ensureDir(this.sessionsDir);
  }

  /**
   * Initialize a feedback session for a document
   */
  async startFeedbackSession(
    documentPath: string,
    programType: string,
    customerName: string
  ): Promise<string> {
    console.log('\n🔄 Starting feedback session...');
    
    // Create a new session
    const sessionId = `session_${Date.now()}`;
    const session: FeedbackSession = {
      sessionId,
      documentPath,
      originalVersion: '',
      iterations: 0,
      status: 'active',
      startTime: new Date(),
      lastUpdate: new Date(),
      changes: []
    };

    // Track the original document
    const versionId = await this.analyzer.trackDocument(documentPath, {
      programType,
      customerName,
      sessionId
    });
    session.originalVersion = versionId;

    // Save session data
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.writeJson(sessionPath, session, { spaces: 2 });

    // Create a git branch for this session if configured
    if (this.config.trackingBranch) {
      try {
        await this.git.checkoutBranch(`${this.config.trackingBranch}/${sessionId}`, 'main');
        await this.git.add(documentPath);
        await this.git.commit(`Start feedback session: ${sessionId}`);
        console.log(`  📌 Created git branch: ${this.config.trackingBranch}/${sessionId}`);
      } catch (error) {
        console.warn('  ⚠️  Git operations failed:', error.message);
      }
    }

    console.log(`  ✅ Session started: ${sessionId}`);
    console.log(`  📄 Document: ${documentPath}`);
    console.log(`  🔖 Version: ${versionId}`);
    
    return sessionId;
  }

  /**
   * Process customer feedback on a document
   */
  async processFeedback(
    sessionId: string,
    editedDocumentPath: string
  ): Promise<void> {
    console.log('\n📝 Processing feedback...');
    
    // Load session data
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
    const session: FeedbackSession = await fs.readJson(sessionPath);
    
    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }

    // Analyze changes
    const report = await this.analyzer.analyzeChanges(editedDocumentPath);
    session.changes.push(report);
    session.iterations++;
    session.lastUpdate = new Date();

    // Generate diff report
    const diffReportPath = await this.analyzer.generateDiffReport(editedDocumentPath);
    console.log(`  📊 Diff report: ${diffReportPath}`);

    // Commit changes if configured
    if (this.config.autoCommit) {
      try {
        await this.git.add(editedDocumentPath);
        await this.git.commit(`Feedback iteration ${session.iterations}: ${report.changes.length} changes`);
        console.log(`  💾 Changes committed to git`);
      } catch (error) {
        console.warn('  ⚠️  Git commit failed:', error.message);
      }
    }

    // Show suggestions
    console.log('\n📋 Suggested Updates:');
    console.log(`  Context updates: ${report.suggestions.contextUpdates.length}`);
    console.log(`  Program updates: ${report.suggestions.programUpdates.length}`);

    // Apply feedback if configured
    if (!this.config.requireApproval || await this.promptApproval()) {
      await this.applyFeedbackUpdates(session, report);
    }

    // Update session
    await fs.writeJson(sessionPath, session, { spaces: 2 });

    // Regenerate if configured
    if (this.config.autoRegenerate) {
      await this.regenerateSolution(session);
    }
  }

  /**
   * Apply feedback updates to context and program files
   */
  private async applyFeedbackUpdates(session: FeedbackSession, report: any): Promise<void> {
    console.log('\n🔧 Applying feedback updates...');
    
    // Extract metadata from the original document path
    const pathParts = path.basename(session.documentPath, '.md').split('_');
    const programType = pathParts[0];
    const customerName = pathParts[1] === 'solution' ? 'trip_com' : pathParts[1];

    // Apply context updates
    if (report.suggestions.contextUpdates.length > 0) {
      await this.updateCustomerContext(customerName, report.suggestions.contextUpdates);
    }

    // Apply program updates
    if (report.suggestions.programUpdates.length > 0) {
      await this.updateProgramConfig(programType, report.suggestions.programUpdates);
    }

    console.log('  ✅ Updates applied successfully');
  }

  /**
   * Update customer context JSON with feedback
   */
  private async updateCustomerContext(customerName: string, updates: any[]): Promise<void> {
    const contextPath = path.join(
      path.dirname(this.sessionsDir),
      'contexts',
      `${customerName === 'trip_com' ? 'triplink' : customerName}_context_v2.json`
    );

    if (!await fs.pathExists(contextPath)) {
      console.warn(`  ⚠️  Context file not found: ${contextPath}`);
      return;
    }

    const context = await fs.readJson(contextPath);
    
    // Apply updates with high confidence
    for (const update of updates) {
      if (update.confidence > 0.6) {
        console.log(`  📝 Updating context: ${update.section}`);
        // Here you would apply specific updates based on the section
        // This is a simplified example
        if (update.section.includes('Requirements')) {
          context.requirements = context.requirements || {};
          // Merge additions
          if (update.suggestedUpdate.additions) {
            context.requirements.additional = update.suggestedUpdate.additions;
          }
        }
      }
    }

    // Save updated context
    await fs.writeJson(contextPath, context, { spaces: 2 });
    console.log(`  💾 Context updated: ${path.basename(contextPath)}`);
  }

  /**
   * Update program YAML with feedback
   */
  private async updateProgramConfig(programType: string, updates: any[]): Promise<void> {
    const configPath = path.join(
      path.dirname(this.sessionsDir),
      'programs',
      `${programType}.yaml`
    );

    if (!await fs.pathExists(configPath)) {
      console.warn(`  ⚠️  Program config not found: ${configPath}`);
      return;
    }

    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = yaml.parse(configContent);
    
    // Apply updates with high confidence
    for (const update of updates) {
      if (update.confidence > 0.6) {
        console.log(`  📝 Updating program: ${update.section}`);
        // Apply specific updates based on the section
        if (update.section === 'workflows' && update.suggestedUpdate.modifiedSteps) {
          // Update workflow steps
          // This is a simplified example
          config.workflows = config.workflows || {};
        }
      }
    }

    // Save updated config
    const updatedYaml = yaml.stringify(config);
    await fs.writeFile(configPath, updatedYaml);
    console.log(`  💾 Program config updated: ${path.basename(configPath)}`);
  }

  /**
   * Regenerate solution with updated context and config
   */
  private async regenerateSolution(session: FeedbackSession): Promise<void> {
    console.log('\n🔄 Regenerating solution...');
    
    // Extract metadata
    const pathParts = path.basename(session.documentPath, '.md').split('_');
    const programType = pathParts[0];
    const customerName = 'trip_com'; // Or extract from path
    
    try {
      // Generate new solution
      const newPath = await this.generator.generateSolution(programType, customerName);
      
      // Also generate HTML
      const exporter = new HTMLExporter();
      const mdContent = await fs.readFile(newPath, 'utf-8');
      const htmlPath = newPath.replace('.md', '.html');
      const htmlContent = await exporter.export(mdContent);
      await fs.writeFile(htmlPath, htmlContent);
      
      console.log(`  ✅ Solution regenerated: ${newPath}`);
      console.log(`  ✅ HTML exported: ${htmlPath}`);
      
      // Track the new version
      await this.analyzer.trackDocument(newPath, {
        programType,
        customerName,
        sessionId: session.sessionId,
        iteration: session.iterations
      });
      
      // Commit if configured
      if (this.config.autoCommit) {
        await this.git.add([newPath, htmlPath]);
        await this.git.commit(`Regenerated solution - iteration ${session.iterations}`);
      }
    } catch (error) {
      console.error('  ❌ Regeneration failed:', error.message);
    }
  }

  /**
   * Complete a feedback session
   */
  async completeFeedbackSession(sessionId: string): Promise<void> {
    console.log('\n✅ Completing feedback session...');
    
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
    const session: FeedbackSession = await fs.readJson(sessionPath);
    
    session.status = 'completed';
    session.lastUpdate = new Date();
    
    await fs.writeJson(sessionPath, session, { spaces: 2 });
    
    // Merge branch if configured
    if (this.config.trackingBranch) {
      try {
        await this.git.checkout('main');
        await this.git.merge([`${this.config.trackingBranch}/${sessionId}`]);
        console.log(`  🔀 Merged feedback branch to main`);
      } catch (error) {
        console.warn('  ⚠️  Git merge failed:', error.message);
      }
    }
    
    console.log(`  ✅ Session completed: ${sessionId}`);
    console.log(`  📊 Total iterations: ${session.iterations}`);
    console.log(`  📝 Total changes: ${session.changes.reduce((sum, r) => sum + r.changes.length, 0)}`);
  }

  /**
   * List all feedback sessions
   */
  async listSessions(): Promise<FeedbackSession[]> {
    const files = await fs.readdir(this.sessionsDir);
    const sessions: FeedbackSession[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const session = await fs.readJson(path.join(this.sessionsDir, file));
        sessions.push(session);
      }
    }
    
    return sessions.sort((a, b) => 
      new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
    );
  }

  /**
   * Get feedback history for a document
   */
  async getDocumentHistory(documentPath: string): Promise<any[]> {
    const sessions = await this.listSessions();
    return sessions.filter(s => s.documentPath === documentPath);
  }

  /**
   * Prompt for approval (simplified for now)
   */
  private async promptApproval(): Promise<boolean> {
    // In a real implementation, use inquirer or similar
    return true;
  }
}
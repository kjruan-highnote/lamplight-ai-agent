import fs from 'fs-extra';
import path from 'path';
import { diffLines, diffWords } from 'diff';
import yaml from 'yaml';
import crypto from 'crypto';

interface FeedbackChange {
  section: string;
  type: 'addition' | 'deletion' | 'modification';
  original?: string;
  updated?: string;
  lineNumber?: number;
  context?: string;
}

interface FeedbackReport {
  documentId: string;
  originalVersion: string;
  updatedVersion: string;
  timestamp: Date;
  changes: FeedbackChange[];
  suggestions: {
    contextUpdates: any[];
    programUpdates: any[];
  };
}

export class FeedbackAnalyzer {
  private feedbackDir: string;
  private versionsDir: string;

  constructor(baseDir: string = '../data') {
    this.feedbackDir = path.join(baseDir, 'feedback');
    this.versionsDir = path.join(baseDir, 'versions');
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.ensureDir(this.feedbackDir);
    await fs.ensureDir(this.versionsDir);
  }

  /**
   * Track a generated document for version control
   */
  async trackDocument(filePath: string, metadata: any): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = this.generateHash(content);
    const versionId = `v_${Date.now()}_${hash.substring(0, 8)}`;
    
    const versionData = {
      versionId,
      filePath,
      hash,
      content,
      metadata,
      timestamp: new Date().toISOString(),
      status: 'original'
    };

    const versionPath = path.join(this.versionsDir, `${versionId}.json`);
    await fs.writeJson(versionPath, versionData, { spaces: 2 });

    // Store mapping for easy lookup
    const mappingPath = path.join(this.versionsDir, 'mapping.json');
    let mapping = {};
    if (await fs.pathExists(mappingPath)) {
      mapping = await fs.readJson(mappingPath);
    }
    mapping[filePath] = versionId;
    await fs.writeJson(mappingPath, mapping, { spaces: 2 });

    return versionId;
  }

  /**
   * Analyze changes between original and edited document
   */
  async analyzeChanges(editedFilePath: string): Promise<FeedbackReport> {
    const editedContent = await fs.readFile(editedFilePath, 'utf-8');
    
    // Find the original version
    const mappingPath = path.join(this.versionsDir, 'mapping.json');
    const mapping = await fs.readJson(mappingPath);
    const versionId = mapping[editedFilePath];
    
    if (!versionId) {
      throw new Error(`No tracked version found for ${editedFilePath}`);
    }

    const versionPath = path.join(this.versionsDir, `${versionId}.json`);
    const versionData = await fs.readJson(versionPath);
    const originalContent = versionData.content;

    // Perform diff analysis
    const changes = this.extractChanges(originalContent, editedContent);
    
    // Generate suggestions based on changes
    const suggestions = this.generateSuggestions(changes, versionData.metadata);

    const report: FeedbackReport = {
      documentId: versionId,
      originalVersion: versionData.hash,
      updatedVersion: this.generateHash(editedContent),
      timestamp: new Date(),
      changes,
      suggestions
    };

    // Save feedback report
    const reportPath = path.join(this.feedbackDir, `feedback_${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    return report;
  }

  /**
   * Extract structured changes from diff
   */
  private extractChanges(original: string, edited: string): FeedbackChange[] {
    const changes: FeedbackChange[] = [];
    const diff = diffLines(original, edited);
    
    let lineNumber = 0;
    let currentSection = '';

    diff.forEach(part => {
      const lines = part.value.split('\n').filter(l => l);
      
      lines.forEach(line => {
        // Track current section
        if (line.startsWith('## ')) {
          currentSection = line.replace('## ', '').trim();
        } else if (line.startsWith('### ')) {
          currentSection = line.replace('### ', '').trim();
        }

        if (part.added) {
          changes.push({
            section: currentSection,
            type: 'addition',
            updated: line,
            lineNumber: lineNumber++,
            context: this.extractContext(line)
          });
        } else if (part.removed) {
          changes.push({
            section: currentSection,
            type: 'deletion',
            original: line,
            lineNumber: lineNumber,
            context: this.extractContext(line)
          });
        } else {
          lineNumber++;
        }
      });
    });

    return changes;
  }

  /**
   * Extract context from a line (what type of content it is)
   */
  private extractContext(line: string): string {
    if (line.match(/^\|\s*\w+\s*\|/)) return 'table';
    if (line.startsWith('- ')) return 'list_item';
    if (line.startsWith('#')) return 'heading';
    if (line.match(/^\d+\./)) return 'numbered_list';
    if (line.match(/^```/)) return 'code_block';
    if (line.match(/^\*\*/)) return 'emphasis';
    if (line.match(/https?:\/\//)) return 'link';
    return 'text';
  }

  /**
   * Generate suggestions for updating context and program configs
   */
  private generateSuggestions(changes: FeedbackChange[], metadata: any) {
    const contextUpdates: any[] = [];
    const programUpdates: any[] = [];

    // Analyze changes by section
    const sectionChanges = this.groupChangesBySection(changes);

    Object.entries(sectionChanges).forEach(([section, sectionChanges]: [string, FeedbackChange[]]) => {
      // Business Context changes -> Update context JSON
      if (section.includes('Business') || section.includes('Objectives') || 
          section.includes('Requirements') || section.includes('Stakeholders')) {
        contextUpdates.push({
          section,
          suggestedUpdate: this.extractContentUpdate(sectionChanges),
          confidence: this.calculateConfidence(sectionChanges)
        });
      }

      // Technical changes -> Update program YAML
      if (section.includes('Performance') || section.includes('API') || 
          section.includes('Compliance') || section.includes('Integration')) {
        programUpdates.push({
          section,
          suggestedUpdate: this.extractContentUpdate(sectionChanges),
          confidence: this.calculateConfidence(sectionChanges)
        });
      }

      // Workflow changes -> Update workflow definitions
      if (section.includes('Workflow') || section.includes('Implementation')) {
        programUpdates.push({
          section: 'workflows',
          suggestedUpdate: this.extractWorkflowUpdate(sectionChanges),
          confidence: this.calculateConfidence(sectionChanges)
        });
      }
    });

    return { contextUpdates, programUpdates };
  }

  /**
   * Group changes by section for easier analysis
   */
  private groupChangesBySection(changes: FeedbackChange[]): Record<string, FeedbackChange[]> {
    const grouped: Record<string, FeedbackChange[]> = {};
    
    changes.forEach(change => {
      const section = change.section || 'General';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(change);
    });

    return grouped;
  }

  /**
   * Extract content updates from changes
   */
  private extractContentUpdate(changes: FeedbackChange[]): any {
    const additions = changes.filter(c => c.type === 'addition').map(c => c.updated);
    const deletions = changes.filter(c => c.type === 'deletion').map(c => c.original);
    
    return {
      additions,
      deletions,
      netChange: additions.length - deletions.length
    };
  }

  /**
   * Extract workflow updates from changes
   */
  private extractWorkflowUpdate(changes: FeedbackChange[]): any {
    // Parse workflow-specific changes
    const workflowSteps = changes.filter(c => 
      c.context === 'numbered_list' || 
      c.updated?.includes('Required') ||
      c.updated?.includes('Optional')
    );

    return {
      modifiedSteps: workflowSteps.map(s => ({
        content: s.updated || s.original,
        action: s.type
      }))
    };
  }

  /**
   * Calculate confidence level for suggestions
   */
  private calculateConfidence(changes: FeedbackChange[]): number {
    const totalChanges = changes.length;
    const additions = changes.filter(c => c.type === 'addition').length;
    const deletions = changes.filter(c => c.type === 'deletion').length;
    
    // Higher confidence for additions, lower for deletions
    const confidence = (additions * 0.8 + (totalChanges - deletions) * 0.2) / totalChanges;
    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Generate hash for content versioning
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Apply feedback to update context and program files
   */
  async applyFeedback(reportPath: string, autoApply: boolean = false): Promise<void> {
    const report: FeedbackReport = await fs.readJson(reportPath);
    
    console.log('\n📋 Feedback Analysis Report:');
    console.log(`  Total changes: ${report.changes.length}`);
    console.log(`  Context suggestions: ${report.suggestions.contextUpdates.length}`);
    console.log(`  Program suggestions: ${report.suggestions.programUpdates.length}`);

    if (autoApply || await this.confirmApply()) {
      // Apply context updates
      for (const update of report.suggestions.contextUpdates) {
        if (update.confidence > 0.6) {
          console.log(`  ✅ Applying context update: ${update.section}`);
          await this.applyContextUpdate(update);
        } else {
          console.log(`  ⚠️  Low confidence for ${update.section}, skipping`);
        }
      }

      // Apply program updates
      for (const update of report.suggestions.programUpdates) {
        if (update.confidence > 0.6) {
          console.log(`  ✅ Applying program update: ${update.section}`);
          await this.applyProgramUpdate(update);
        } else {
          console.log(`  ⚠️  Low confidence for ${update.section}, skipping`);
        }
      }

      console.log('\n✨ Feedback applied successfully!');
    }
  }

  /**
   * Apply updates to context JSON
   */
  private async applyContextUpdate(update: any): Promise<void> {
    // Implementation to update context JSON
    // This would modify the triplink_context_v2.json file
    console.log(`  Updating context section: ${update.section}`);
  }

  /**
   * Apply updates to program YAML
   */
  private async applyProgramUpdate(update: any): Promise<void> {
    // Implementation to update program YAML
    // This would modify the ap_automation.yaml file
    console.log(`  Updating program section: ${update.section}`);
  }

  /**
   * Interactive confirmation for applying changes
   */
  private async confirmApply(): Promise<boolean> {
    // In a real implementation, this would use inquirer or similar
    // For now, return true for testing
    return true;
  }

  /**
   * Generate a diff report for review
   */
  async generateDiffReport(editedFilePath: string): Promise<string> {
    const report = await this.analyzeChanges(editedFilePath);
    
    let diffReport = '# Feedback Analysis Report\n\n';
    diffReport += `Generated: ${report.timestamp}\n\n`;
    diffReport += `## Summary\n`;
    diffReport += `- Total changes: ${report.changes.length}\n`;
    diffReport += `- Additions: ${report.changes.filter(c => c.type === 'addition').length}\n`;
    diffReport += `- Deletions: ${report.changes.filter(c => c.type === 'deletion').length}\n`;
    diffReport += `- Modifications: ${report.changes.filter(c => c.type === 'modification').length}\n\n`;

    diffReport += `## Changes by Section\n\n`;
    const grouped = this.groupChangesBySection(report.changes);
    
    Object.entries(grouped).forEach(([section, changes]) => {
      diffReport += `### ${section}\n`;
      changes.forEach(change => {
        if (change.type === 'addition') {
          diffReport += `+ ${change.updated}\n`;
        } else if (change.type === 'deletion') {
          diffReport += `- ${change.original}\n`;
        }
      });
      diffReport += '\n';
    });

    diffReport += `## Suggested Updates\n\n`;
    diffReport += `### Context Updates\n`;
    report.suggestions.contextUpdates.forEach(update => {
      diffReport += `- ${update.section} (confidence: ${(update.confidence * 100).toFixed(0)}%)\n`;
    });

    diffReport += `\n### Program Updates\n`;
    report.suggestions.programUpdates.forEach(update => {
      diffReport += `- ${update.section} (confidence: ${(update.confidence * 100).toFixed(0)}%)\n`;
    });

    const reportPath = path.join(this.feedbackDir, `diff_report_${Date.now()}.md`);
    await fs.writeFile(reportPath, diffReport);
    
    return reportPath;
  }
}
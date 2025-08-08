import type { Workflow, WorkflowStep } from '../types/index.js';

export class DiagramGenerator {
  generateWorkflowDiagrams(
    workflows: Record<string, Workflow>,
    customerName: string,
    vendorName: string
  ): Record<string, string> {
    const diagrams: Record<string, string> = {};

    for (const [workflowId, workflow] of Object.entries(workflows)) {
      diagrams[workflowId] = this.generateSequenceDiagram(
        workflow,
        customerName,
        vendorName
      );
    }

    return diagrams;
  }

  private generateSequenceDiagram(
    workflow: Workflow,
    customerName: string,
    vendorName: string
  ): string {
    const lines: string[] = [];
    
    // Sanitize and format names for Mermaid
    const safeCustomerName = this.formatParticipantName(customerName);
    const safeVendorName = this.formatParticipantName(vendorName);
    
    // Start mermaid block
    lines.push('```mermaid');
    lines.push('sequenceDiagram');
    lines.push('    autonumber');
    lines.push(`    title ${workflow.name}`);
    lines.push('');
    
    // Define participants with aliases
    const participants = this.identifyParticipants(workflow);
    
    // Always include customer and vendor
    lines.push(`    participant CUSTOMER as ${safeCustomerName}`);
    lines.push(`    participant VENDOR as ${safeVendorName}`);
    
    // Add other participants
    if (participants.has('webhook')) {
      lines.push('    participant WEBHOOK as "Webhook Service"');
    }
    if (participants.has('auth')) {
      lines.push('    participant AUTH as "Auth Service"');
    }
    if (participants.has('payment')) {
      lines.push('    participant PAYMENT as "Payment Processor"');
    }
    
    lines.push('');
    
    // Add description note if available
    if (workflow.description) {
      lines.push(`    Note over CUSTOMER: ${workflow.description}`);
      lines.push('');
    }
    
    // Process workflow steps
    for (const step of workflow.steps) {
      const stepLines = this.generateStepSequence(step);
      lines.push(...stepLines);
    }
    
    // Add completion note
    lines.push('');
    lines.push('    Note over CUSTOMER,VENDOR: Workflow Complete');
    lines.push('```');
    
    return lines.join('\n');
  }

  private identifyParticipants(workflow: Workflow): Set<string> {
    const participants = new Set<string>();
    
    for (const step of workflow.steps) {
      const operation = step.operation.toLowerCase();
      
      if (operation.includes('webhook') || operation.includes('event')) {
        participants.add('webhook');
      }
      if (operation.includes('auth') || operation.includes('authorize')) {
        participants.add('auth');
      }
      if (operation.includes('payment') || operation.includes('transaction')) {
        participants.add('payment');
      }
    }
    
    return participants;
  }

  private generateStepSequence(step: WorkflowStep): string[] {
    const lines: string[] = [];
    const { source, target } = this.determineActors(step.operation);
    
    // Handle conditional steps
    if (step.condition) {
      lines.push(`    alt ${step.condition}`);
      lines.push(`        ${source}->>+${target}: ${step.operation}${step.required ? ' [Required]' : ''}`);
      
      if (step.description) {
        lines.push(`        Note right of ${target}: ${step.description.substring(0, 50)}...`);
      }
      
      const response = this.determineResponse(step.operation);
      lines.push(`        ${target}-->>-${source}: ${response}`);
      lines.push('    end');
    } else {
      lines.push(`    ${source}->>+${target}: ${step.operation}${step.required ? ' [Required]' : ''}`);
      
      if (step.description) {
        lines.push(`    Note right of ${target}: ${step.description.substring(0, 50)}...`);
      }
      
      const response = this.determineResponse(step.operation);
      lines.push(`    ${target}-->>-${source}: ${response}`);
    }
    
    lines.push('');
    return lines;
  }

  private determineActors(operation: string): { source: string; target: string } {
    const op = operation.toLowerCase();
    
    // Default actors
    let source = 'CUSTOMER';
    let target = 'VENDOR';
    
    // Special cases
    if (op.includes('webhook') || op.includes('event')) {
      if (op.includes('callback') || op.includes('notify')) {
        source = 'VENDOR';
        target = 'CUSTOMER';
      } else {
        target = 'WEBHOOK';
      }
    } else if (op.includes('authorize') && op.includes('simulate')) {
      target = 'AUTH';
    } else if (op.includes('payment') || op.includes('charge')) {
      target = 'PAYMENT';
    }
    
    return { source, target };
  }

  private determineResponse(operation: string): string {
    const op = operation.toLowerCase();
    
    if (op.includes('create')) return 'Created (201)';
    if (op.includes('update')) return 'Updated (200)';
    if (op.includes('delete')) return 'Deleted (204)';
    if (op.includes('get') || op.includes('list')) return 'Data Response (200)';
    if (op.includes('activate')) return 'Activated (200)';
    if (op.includes('suspend')) return 'Suspended (200)';
    if (op.includes('simulate')) return 'Simulation Complete';
    
    return 'Success (200)';
  }

  private sanitizeForMermaid(text: string): string {
    // Replace underscores with spaces for better readability
    // Remove dots and other special characters that might cause issues
    return text
      .replace(/_/g, ' ')
      .replace(/\./g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim();
  }

  private formatParticipantName(text: string): string {
    // Sanitize the text first
    const sanitized = this.sanitizeForMermaid(text);
    
    // If the name contains spaces, wrap it in quotes for Mermaid
    if (sanitized.includes(' ')) {
      return `"${sanitized}"`;
    }
    
    return sanitized;
  }

  generateMermaidTemplate(workflowName: string): string {
    return `\`\`\`mermaid
sequenceDiagram
    autonumber
    title ${workflowName}
    
    participant CUSTOMER as {{customerName}}
    participant VENDOR as {{vendorName}}
    participant WEBHOOK as {{webhookService}}
    
    Note over CUSTOMER: Workflow begins
    
    CUSTOMER->>+VENDOR: Request Operation
    VENDOR-->>-CUSTOMER: Response
    
    Note over CUSTOMER,VENDOR: Workflow Complete
\`\`\``;
  }
}
import { Handler } from '@netlify/functions';
import { MongoClient, Db, ObjectId } from 'mongodb';
import * as jwt from 'jsonwebtoken';

// MongoDB connection
let cachedDb: Db | null = null;

async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'geck';
  
  const client = new MongoClient(uri);
  await client.connect();
  
  cachedDb = client.db(dbName);
  return cachedDb;
}

// Verify JWT token
function verifyToken(token: string): any {
  // Check if it's a dev token (base64 encoded JSON)
  if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_DEV_AUTH === 'true') {
    try {
      // Try to decode as base64 JSON (dev token)
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const user = JSON.parse(decoded);
      if (user.id && user.email) {
        return user;
      }
    } catch (e) {
      // Not a dev token, try JWT
    }
  }
  
  // Standard JWT verification
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.verify(token, secret);
}

// Helper function to convert markdown to HTML
function convertMarkdownToHTML(markdown: string): string {
  // Basic markdown to HTML conversion
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Convert bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert code blocks
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, '<div class="mermaid"><pre>$1</pre></div>');
  html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Convert lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return '<ul>' + match + '</ul>';
  });
  
  // Convert tables
  html = html.replace(/\|(.+)\|\n\|[-: ]+\|\n((?:\|.+\|\n?)+)/g, (match, headers, rows) => {
    const headerCells = headers.split('|').filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join('');
    const rowLines = rows.trim().split('\n');
    const tableRows = rowLines.map((row: string) => {
      const cells = row.split('|').filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${tableRows}</tbody></table>`;
  });
  
  // Convert blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  
  // Convert paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>|<ol>|<table>|<pre>|<blockquote>|<hr>)/g, '$1');
  html = html.replace(/(<\/ul>|<\/ol>|<\/table>|<\/pre>|<\/blockquote>|<hr>)<\/p>/g, '$1');
  
  return html;
}

// Helper function to format operations table
function formatOperationsTable(operations: any[]): string {
  if (!operations || operations.length === 0) {
    return 'No operations defined';
  }
  
  let table = '| Operation | Type | Required | Description |\n';
  table += '|-----------|------|----------|-------------|\n';
  
  operations.forEach((op: any) => {
    const name = op.name || '-';
    const type = op.type || '-';
    const required = op.required ? 'Yes' : 'No';
    const description = op.description || '-';
    table += `| ${name} | ${type} | ${required} | ${description} |\n`;
  });
  
  return table;
}

// Helper function to format KPI table
function formatKPITable(kpis: any[]): string {
  if (!kpis || kpis.length === 0) {
    return 'No KPIs defined';
  }
  
  let table = '| Metric | Target | Timeline |\n';
  table += '|--------|--------|----------|\n';
  
  kpis.forEach((kpi: any) => {
    table += `| ${kpi.metric || '-'} | ${kpi.target || '-'} | ${kpi.timeline || '-'} |\n`;
  });
  
  return table;
}

// Helper function to format contacts table  
function formatContactsTable(contacts: any[]): string {
  if (!contacts || contacts.length === 0) {
    return 'No contacts defined';
  }
  
  let table = '| Name | Role | Email |\n';
  table += '|------|------|-------|\n';
  
  contacts.forEach((contact: any) => {
    table += `| ${contact.name || '-'} | ${contact.role || '-'} | ${contact.email || '-'} |\n`;
  });
  
  return table;
}

// Generate solution document content
function generateSolutionDocument(program: any, context: any, options: any): any {
  const programName = program?.metadata?.name || program?.program_type || 'API Program';
  const customerName = context?.customer?.name || 'Customer';
  const title = `${programName} Program for ${customerName}`;
  
  let content = '';
  const sections = [];
  
  // Document Header
  content += `# ${title}\n\n`;
  content += `**Document Version:** ${program?.version || '1.0'}  \n`;
  content += `**Generated:** ${new Date().toLocaleDateString()}  \n`;
  content += `**Program Type:** ${program?.program_type || 'N/A'}  \n`;
  content += `**Vendor:** ${program?.vendor || 'N/A'}  \n`;
  content += `**API Type:** ${program?.api_type || 'N/A'}\n\n`;
  
  // Executive Summary
  sections.push('Executive Summary');
  content += `## Executive Summary\n\n`;
  content += `This document outlines the ${program?.program_type || 'integration'} solution for ${customerName} using ${program?.vendor || 'the vendor'}'s ${program?.api_type || 'API'} platform.\n\n`;
  
  if (context?.business_context?.current_state) {
    content += `### Current State\n\n`;
    content += `${context.business_context.current_state.description || 'No description provided'}\n\n`;
    
    if (context.business_context.current_state.pain_points?.length > 0) {
      content += `**Pain Points:**\n`;
      context.business_context.current_state.pain_points.forEach((point: string) => {
        content += `- ${point}\n`;
      });
      content += '\n';
    }
  }
  
  if (context?.business_context?.business_model) {
    content += `### Business Model\n\n`;
    content += `${context.business_context.business_model.description || 'No description provided'}\n\n`;
    
    if (context.business_context.business_model.key_points?.length > 0) {
      content += `**Key Points:**\n`;
      context.business_context.business_model.key_points.forEach((point: string) => {
        content += `- ${point}\n`;
      });
      content += '\n';
    }
  }
  
  if (context?.business_context?.objectives) {
    content += `### Objectives\n\n`;
    
    if (context.business_context.objectives.primary?.length > 0) {
      content += `**Primary Objectives:**\n`;
      context.business_context.objectives.primary.forEach((obj: string) => {
        content += `- ${obj}\n`;
      });
      content += '\n';
    }
    
    if (context.business_context.objectives.secondary?.length > 0) {
      content += `**Secondary Objectives:**\n`;
      context.business_context.objectives.secondary.forEach((obj: string) => {
        content += `- ${obj}\n`;
      });
      content += '\n';
    }
  }
  
  if (program?.capabilities?.length > 0) {
    content += `### Key Capabilities\n\n`;
    program.capabilities.forEach((cap: string) => {
      content += `- **${cap}**\n`;
    });
    content += '\n';
  }
  
  // Technical Overview
  sections.push('Technical Overview');
  content += `## Technical Overview\n\n`;
  
  content += `### Architecture\n\n`;
  content += `The solution is built on a modern ${program?.api_type || 'API'} architecture providing:\n\n`;
  
  if (program?.api_type === 'graphql') {
    content += `- **Single Endpoint**: Unified GraphQL endpoint for all operations\n`;
    content += `- **Strong Typing**: Type-safe operations with comprehensive schema\n`;
    content += `- **Efficient Queries**: Request only needed data\n`;
    content += `- **Real-time Updates**: Webhook notifications for events\n\n`;
  } else if (program?.api_type === 'rest') {
    content += `- **RESTful Design**: Resource-based API following REST principles\n`;
    content += `- **Standard Methods**: GET, POST, PUT, DELETE operations\n`;
    content += `- **JSON Format**: Consistent JSON request/response format\n`;
    content += `- **API Versioning**: Stable versioned endpoints\n\n`;
  } else {
    content += `- **Modern Architecture**: Scalable and reliable API design\n`;
    content += `- **Standard Protocols**: Industry-standard communication\n`;
    content += `- **Secure Communication**: Encrypted data transmission\n\n`;
  }
  
  if (program?.capabilities?.length > 0) {
    content += `### Capabilities\n\n`;
    program.capabilities.forEach((cap: string) => {
      content += `- ${cap}\n`;
    });
    content += '\n';
  }
  
  if (program?.entities?.length > 0) {
    content += `### Core Entities\n\n`;
    content += `The solution manages the following core entities:\n\n`;
    program.entities.forEach((entity: any) => {
      const isPrimary = entity.primary ? ' (Primary Entity)' : '';
      content += `- **${entity.name}**: ${entity.description || 'Core entity'}${isPrimary}\n`;
    });
    content += '\n';
  }
  
  if (program?.performance) {
    content += `### Performance Requirements\n\n`;
    
    if (program.performance.request_rate) {
      content += `#### Rate Limits\n`;
      Object.entries(program.performance.request_rate).forEach(([key, value]) => {
        content += `- **${key}**: ${value}\n`;
      });
      content += '\n';
    }
    
    if (program.performance.complexity) {
      content += `#### Complexity Limits\n`;
      Object.entries(program.performance.complexity).forEach(([key, value]) => {
        content += `- **${key}**: ${value}\n`;
      });
      content += '\n';
    }
    
    if (program.performance.api) {
      content += `#### API Performance\n`;
      content += `- **Response Time**: ${program.performance.api.response_time_ms}ms\n`;
      content += `- **Availability**: ${program.performance.api.availability}%\n`;
      content += '\n';
    }
    
    if (program.performance.transactions) {
      content += `#### Transaction Performance\n`;
      content += `- **Collaborative Authorization Time**: ${program.performance.transactions.collaborative_authorization_time_ms}ms\n`;
      content += '\n';
    }
    
    content += '\n';
  }
  
  // Use Cases
  if (context?.use_cases) {
    sections.push('Use Cases');
    content += `## Use Cases\n\n`;
    
    if (context.use_cases.primary?.length > 0) {
      content += `### Primary Use Cases\n\n`;
      context.use_cases.primary.forEach((useCase: any) => {
        content += `#### ${useCase.title}\n\n`;
        content += `${useCase.description || 'No description'}\n\n`;
        
        if (useCase.scenarios?.length > 0) {
          useCase.scenarios.forEach((scenario: string) => {
            content += `- ${scenario}\n`;
          });
          content += '\n';
        }
        
        if (useCase.value_proposition) {
          content += `**Value:** ${useCase.value_proposition}\n\n`;
        }
      });
    }
    
    if (context.use_cases.secondary?.length > 0) {
      content += `### Secondary Use Cases\n\n`;
      context.use_cases.secondary.forEach((useCase: any) => {
        content += `#### ${useCase.title}\n\n`;
        content += `${useCase.description || 'No description'}\n\n`;
        
        if (useCase.scenarios?.length > 0) {
          useCase.scenarios.forEach((scenario: string) => {
            content += `- ${scenario}\n`;
          });
          content += '\n';
        }
      });
    }
  }
  
  // Implementation Workflows
  if (program?.workflows && Object.keys(program.workflows).length > 0) {
    sections.push('Implementation Workflows');
    content += `## Implementation Workflows\n\n`;
    
    Object.entries(program.workflows).forEach(([key, workflow]: [string, any]) => {
      content += `### ${workflow.name}\n\n`;
      content += `${workflow.description || 'No description'}\n\n`;
      
      // Include diagram if available
      if (workflow.diagram) {
        if (workflow.diagram.type === 'mermaid' && workflow.diagram.content) {
          content += `\`\`\`mermaid\n${workflow.diagram.content}\n\`\`\`\n\n`;
        } else if (workflow.diagram.type === 'markdown' && workflow.diagram.content) {
          content += `${workflow.diagram.content}\n\n`;
        }
      }
      
      if (workflow.steps?.length > 0) {
        content += `**Steps:**\n\n`;
        workflow.steps.forEach((step: any, idx: number) => {
          const required = step.required ? ' (Required)' : ' (Optional)';
          content += `${idx + 1}. **${step.operation}**${required}\n`;
          content += `   - ${step.description || 'No description'}\n`;
        });
        content += '\n';
      }
    });
  }
  
  // API Operations Reference
  if (program?.categories?.length > 0) {
    sections.push('API Operations Reference');
    content += `## API Operations Reference\n\n`;
    
    content += `### Operations by Category\n\n`;
    
    program.categories.forEach((category: any) => {
      content += `#### ${category.display_name || category.name}\n\n`;
      if (category.description) {
        content += `${category.description}\n\n`;
      }
      
      const operations = category.operations || [];
      content += `\nTotal operations: ${operations.length}\n\n`;
      content += formatOperationsTable(operations);
      content += '\n';
    });
  }
  
  // Integration Guide
  sections.push('Integration Guide');
  content += `## Integration Guide\n\n`;
  
  content += `### Prerequisites\n\n`;
  content += `1. **API Credentials**\n`;
  content += `   - Organization ID\n`;
  content += `   - API Key with appropriate permissions\n`;
  content += `   - Webhook endpoint for async events\n\n`;
  content += `2. **Environment Setup**\n`;
  content += `   - Sandbox environment for testing\n`;
  content += `   - Production environment credentials\n\n`;
  
  if (program?.metadata?.authentication) {
    content += `### Authentication\n\n`;
    content += `- **Type**: ${program.metadata.authentication.type}${program.metadata.authentication.format ? ` ${program.metadata.authentication.format}` : ''}\n`;
    content += `- **Header**: ${program.metadata.authentication.header || 'Authorization'}\n`;
    content += `- **Base URL**: ${program.metadata.base_url || '{{apiUrl}}'}\n\n`;
  }
  
  content += `### Quick Start\n\n`;
  content += `1. Obtain API credentials\n`;
  content += `2. Configure webhook endpoints\n`;
  content += `3. Test connectivity with ping operation\n`;
  content += `4. Implement core workflows\n`;
  content += `5. Perform end-to-end testing\n\n`;
  
  content += `### Best Practices\n\n`;
  content += `- Implement exponential backoff for retries\n`;
  content += `- Use idempotency keys for mutations\n`;
  content += `- Monitor rate limits\n`;
  content += `- Implement proper error handling\n`;
  content += `- Use webhook events for async operations\n\n`;
  
  // Requirements
  if (context?.requirements) {
    sections.push('Requirements');
    content += `## Requirements\n\n`;
    
    if (context.requirements.business?.length > 0) {
      content += `### Business Requirements\n\n`;
      context.requirements.business.forEach((req: string) => {
        content += `- ${req}\n`;
      });
      content += '\n';
    }
    
    if (context.requirements.operational?.length > 0) {
      content += `### Operational Requirements\n\n`;
      context.requirements.operational.forEach((req: string) => {
        content += `- ${req}\n`;
      });
      content += '\n';
    }
    
    if (context.requirements.financial?.length > 0) {
      content += `### Financial Requirements\n\n`;
      context.requirements.financial.forEach((req: string) => {
        content += `- ${req}\n`;
      });
      content += '\n';
    }
    
    content += '\n';
  }
  
  // Compliance and Security
  if (program?.compliance) {
    sections.push('Compliance and Security');
    content += `## Compliance and Security\n\n`;
    
    if (program.compliance.standards?.length > 0) {
      content += `### Compliance Standards\n\n`;
      program.compliance.standards.forEach((std: any) => {
        const required = std.required ? ' - Required' : '';
        const level = std.level ? ` (Level ${std.level})` : '';
        content += `- **${std.name}**${level}${required}\n`;
      });
      content += '\n';
    }
    
    if (program.compliance.regulations?.length > 0) {
      content += `### Regulatory Requirements\n\n`;
      program.compliance.regulations.forEach((reg: any) => {
        content += `- **${reg.name}**: ${reg.description || 'No description'}\n`;
      });
      content += '\n';
    }
    
    if (program.compliance.security) {
      content += `### Security Requirements\n\n`;
      
      if (program.compliance.security.encryption) {
        content += `#### Encryption\n`;
        content += `- **In Transit**: ${program.compliance.security.encryption.in_transit}\n`;
        content += `- **At Rest**: ${program.compliance.security.encryption.at_rest}\n\n`;
      }
      
      if (program.compliance.security.authentication?.length > 0) {
        content += `#### Authentication\n`;
        program.compliance.security.authentication.forEach((auth: any) => {
          const rotation = auth.rotation_days ? ` (Rotation: ${auth.rotation_days} days)` : '';
          content += `- **Type**: ${auth.type}${rotation}\n`;
        });
        content += '\n';
      }
      
      if (program.compliance.security.data_retention) {
        content += `#### Data Retention\n`;
        Object.entries(program.compliance.security.data_retention).forEach(([key, value]) => {
          content += `- **${key}**: ${value}\n`;
        });
        content += '\n';
      }
    }
  }
  
  // Integration Requirements
  if (program?.integrations) {
    sections.push('Integration Requirements');
    content += `## Integration Requirements\n\n`;
    
    if (program.integrations.webhooks) {
      content += `### Webhooks\n\n`;
      content += `**Required**: ${program.integrations.webhooks.required ? 'Yes' : 'No'}\n\n`;
      
      if (program.integrations.webhooks.events?.length > 0) {
        content += `#### Webhook Events\n`;
        program.integrations.webhooks.events.forEach((event: string) => {
          content += `- ${event}\n`;
        });
        content += '\n';
      }
    }
    
    if (program.integrations.reporting) {
      content += `### Reporting\n\n`;
      
      if (program.integrations.reporting.formats?.length > 0) {
        content += `#### Supported Formats\n`;
        program.integrations.reporting.formats.forEach((format: string) => {
          content += `- ${format}\n`;
        });
        content += '\n';
      }
      
      if (program.integrations.reporting.frequency?.length > 0) {
        content += `#### Reporting Frequency\n`;
        program.integrations.reporting.frequency.forEach((freq: string) => {
          content += `- ${freq}\n`;
        });
        content += '\n';
      }
    }
  }
  
  // Success Metrics
  if (context?.success_metrics) {
    sections.push('Success Metrics');
    content += `## Success Metrics\n\n`;
    
    if (context.success_metrics.kpis?.length > 0) {
      content += `### Key Performance Indicators\n\n`;
      content += formatKPITable(context.success_metrics.kpis);
      content += '\n';
    }
    
    if (context.success_metrics.milestones?.length > 0) {
      content += `### Implementation Milestones\n\n`;
      context.success_metrics.milestones.forEach((milestone: any) => {
        content += `#### ${milestone.phase}\n\n`;
        content += `**Description:** ${milestone.description || 'No description'}  \n`;
        content += `**Timeline:** ${milestone.timeline || 'TBD'}  \n`;
        content += `**Success Criteria:** ${milestone.success_criteria || 'TBD'}\n\n`;
      });
    }
  }
  
  // Stakeholders
  if (context?.stakeholders) {
    sections.push('Stakeholders');
    content += `## Stakeholders\n\n`;
    
    if (context.stakeholders.executive_sponsor) {
      content += `- **Executive Sponsor:** ${context.stakeholders.executive_sponsor}\n`;
    }
    if (context.stakeholders.business_owner) {
      content += `- **Business Owner:** ${context.stakeholders.business_owner}\n`;
    }
    if (context.stakeholders.technical_lead) {
      content += `- **Technical Lead:** ${context.stakeholders.technical_lead}\n`;
    }
    
    if (context.stakeholders.end_users?.length > 0) {
      content += `\n### End Users\n`;
      context.stakeholders.end_users.forEach((user: string) => {
        content += `- ${user}\n`;
      });
    }
    content += '\n';
  }
  
  // Integration Landscape
  if (context?.integration_landscape) {
    sections.push('Integration Landscape');
    content += `## Integration Landscape\n\n`;
    
    if (context.integration_landscape.internal_systems?.length > 0) {
      content += `### Internal Systems\n\n`;
      context.integration_landscape.internal_systems.forEach((system: string) => {
        content += `- ${system}\n`;
      });
      content += '\n';
    }
    
    if (context.integration_landscape.external_partners?.length > 0) {
      content += `### External Partners\n\n`;
      context.integration_landscape.external_partners.forEach((partner: string) => {
        content += `- ${partner}\n`;
      });
      content += '\n';
    }
  }
  
  // Risk Considerations
  if (context?.risk_considerations) {
    sections.push('Risk Considerations');
    content += `## Risk Considerations\n\n`;
    
    if (context.risk_considerations.business_risks?.length > 0) {
      content += `### Business Risks\n\n`;
      context.risk_considerations.business_risks.forEach((risk: string) => {
        content += `- ${risk}\n`;
      });
      content += '\n';
    }
    
    if (context.risk_considerations.mitigation_strategies?.length > 0) {
      content += `### Mitigation Strategies\n\n`;
      context.risk_considerations.mitigation_strategies.forEach((strategy: string) => {
        content += `- ${strategy}\n`;
      });
      content += '\n';
    }
  }
  
  // Appendices
  sections.push('Appendices');
  content += `## Appendices\n\n`;
  
  if (context?.customer?.contacts?.length > 0) {
    content += `### Appendix A: Customer Contacts\n\n`;
    content += formatContactsTable(context.customer.contacts);
    content += '\n';
  }
  
  content += `### Appendix B: Glossary\n\n`;
  content += `| Term | Definition |\n`;
  content += `|------|------------|\n`;
  content += `| API | Application Programming Interface |\n`;
  if (program?.api_type === 'graphql') {
    content += `| GraphQL | Query language for APIs |\n`;
    content += `| Mutation | Operation that modifies data |\n`;
    content += `| Query | Operation that retrieves data |\n`;
  } else {
    content += `| REST | Representational State Transfer |\n`;
  }
  content += `| Webhook | HTTP callback for events |\n`;
  content += '\n';
  
  if (program?.resources) {
    content += `### Appendix C: Resources\n\n`;
    
    if (program.resources.documentation?.length > 0) {
      content += `#### Documentation\n`;
      program.resources.documentation.forEach((doc: any) => {
        if (doc.url) {
          content += `- [${doc.name}](${doc.url})\n`;
        } else {
          content += `- ${doc.name}\n`;
        }
      });
      content += '\n';
    }
    
    if (program.resources.developer_tools?.length > 0) {
      content += `#### Developer Tools\n`;
      program.resources.developer_tools.forEach((tool: any) => {
        if (tool.url) {
          content += `- [${tool.name}](${tool.url})\n`;
        } else {
          content += `- ${tool.name}\n`;
        }
      });
      content += '\n';
    }
    
    if (program.resources.support?.length > 0) {
      content += `#### Support\n`;
      program.resources.support.forEach((support: any) => {
        if (support.url) {
          content += `- [${support.name}](${support.url})\n`;
        } else {
          content += `- ${support.name}\n`;
        }
      });
      content += '\n';
    }
    
    if (program.resources.monitoring?.length > 0) {
      content += `#### Monitoring\n`;
      program.resources.monitoring.forEach((monitor: any) => {
        if (monitor.url) {
          content += `- [${monitor.name}](${monitor.url})\n`;
        } else {
          content += `- ${monitor.name}\n`;
        }
      });
      content += '\n';
    }
  }
  
  content += `---\n\n\n`;
  
  return {
    title,
    content,
    sections,
    metadata: {
      generatedAt: new Date().toISOString(),
      programType: program?.program_type,
      vendor: program?.vendor,
      apiType: program?.api_type,
      customerName: context?.customer?.name,
      version: program?.version || '1.0'
    }
  };
}

// Generate workflow diagram content
function generateWorkflowDiagram(program: any, context: any, options: any): any {
  const title = `${program?.metadata?.name || program?.program_type || 'API'} Workflow Diagram`;
  
  let mermaidDiagram = 'graph TD\n';
  
  if (program?.workflows?.length > 0) {
    program.workflows.forEach((workflow: any, wfIdx: number) => {
      if (workflow.steps?.length > 0) {
        workflow.steps.forEach((step: any, idx: number) => {
          const nodeId = `${wfIdx}_${idx}`;
          const nextNodeId = `${wfIdx}_${idx + 1}`;
          
          mermaidDiagram += `    ${nodeId}[${step.name}]\n`;
          
          if (idx < workflow.steps.length - 1) {
            mermaidDiagram += `    ${nodeId} --> ${nextNodeId}\n`;
          }
        });
      }
    });
  } else {
    mermaidDiagram += '    Start[Start] --> Process[Process] --> End[End]\n';
  }
  
  const content = `# ${title}\n\n\`\`\`mermaid\n${mermaidDiagram}\`\`\`\n\n## Workflow Details\n\n${
    program?.workflows?.map((wf: any) => `### ${wf.name}\n${wf.description || 'No description'}`).join('\n\n') || 'No workflows defined'
  }`;
  
  return {
    title,
    content,
    sections: ['Diagram', 'Workflow Details'],
    metadata: {
      generatedAt: new Date().toISOString(),
      diagramType: 'mermaid',
      workflowCount: program?.workflows?.length || 0
    }
  };
}

// Generate ERD diagram content
function generateERDDiagram(program: any, context: any, options: any): any {
  const title = `${program?.metadata?.name || program?.program_type || 'API'} Entity Relationship Diagram`;
  
  let mermaidDiagram = 'erDiagram\n';
  
  // Extract entities from operations or use defaults
  const entities = new Set<string>();
  
  if (program?.operations?.length > 0) {
    program.operations.forEach((op: any) => {
      if (op.entity) entities.add(op.entity);
      if (op.input_schema?.properties) {
        Object.keys(op.input_schema.properties).forEach(prop => {
          if (prop.endsWith('Id') || prop.endsWith('_id')) {
            const entity = prop.replace(/Id$|_id$/, '');
            entities.add(entity.charAt(0).toUpperCase() + entity.slice(1));
          }
        });
      }
    });
  }
  
  if (entities.size === 0) {
    // Default entities if none found
    entities.add('Customer');
    entities.add('Order');
    entities.add('Product');
  }
  
  // Generate simple ERD
  const entityArray = Array.from(entities);
  entityArray.forEach((entity, idx) => {
    mermaidDiagram += `    ${entity} {\n`;
    mermaidDiagram += `        string id\n`;
    mermaidDiagram += `        string name\n`;
    mermaidDiagram += `        datetime created_at\n`;
    mermaidDiagram += `        datetime updated_at\n`;
    mermaidDiagram += `    }\n`;
    
    if (idx > 0) {
      mermaidDiagram += `    ${entityArray[0]} ||--o{ ${entity} : has\n`;
    }
  });
  
  const content = `# ${title}\n\n\`\`\`mermaid\n${mermaidDiagram}\`\`\`\n\n## Entity Details\n\n${
    entityArray.map(entity => `### ${entity}\nCore entity in the system`).join('\n\n')
  }`;
  
  return {
    title,
    content,
    sections: ['Diagram', 'Entity Details'],
    metadata: {
      generatedAt: new Date().toISOString(),
      diagramType: 'mermaid-erd',
      entityCount: entities.size
    }
  };
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Skip auth check for GET /generators/types - public endpoint
  const path = event.path.replace('/.netlify/functions/generators', '').replace('/generators', '');
  const segments = path.split('/').filter(Boolean);
  
  if (event.httpMethod === 'GET' && segments[0] === 'types') {
    // Return generator types without auth
    const types = [
      {
        id: 'solution',
        name: 'Solution Document',
        description: 'Generate comprehensive solution documents for API programs',
        icon: '📄',
        category: 'documents',
        requiredFields: ['programId'],
        optionalFields: ['contextId'],
        exportFormats: ['markdown', 'pdf', 'html', 'confluence', 'docx'],
      },
      {
        id: 'workflow',
        name: 'Workflow Diagram',
        description: 'Create sequence diagrams for business workflows',
        icon: '📊',
        category: 'diagrams',
        requiredFields: ['programId'],
        optionalFields: ['contextId'],
        exportFormats: ['markdown', 'html', 'pdf'],
      },
      {
        id: 'erd',
        name: 'ERD Diagram',
        description: 'Generate entity relationship diagrams for data models',
        icon: '🗂️',
        category: 'diagrams',
        requiredFields: ['programId'],
        optionalFields: [],
        exportFormats: ['markdown', 'html', 'pdf'],
      },
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(types),
    };
  }

  // Verify authentication for other endpoints
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth header missing or invalid:', authHeader);
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized - No valid auth token' }),
    };
  }

  try {
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    console.log('User verified:', user);
    
    const db = await connectToDatabase();

    // POST /generators - Generate a document
    if (event.httpMethod === 'POST' && segments.length === 0) {
      const body = JSON.parse(event.body || '{}');
      
      // Validate request
      if (!body.type || !body.config) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields: type, config' }),
        };
      }

      // Get program and context data from MongoDB
      let program = null;
      let context = null;

      if (body.config.programId) {
        program = await db.collection('programs').findOne({ 
          _id: new ObjectId(body.config.programId) 
        });
        if (!program) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Program not found' }),
          };
        }
      }

      if (body.config.contextId) {
        context = await db.collection('contexts').findOne({ 
          _id: new ObjectId(body.config.contextId) 
        });
        if (!context) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Context not found' }),
          };
        }
      }

      // Create generation record
      const generationRecord = {
        type: body.type,
        status: 'generating',
        userId: user.id,
        programId: body.config.programId,
        contextId: body.config.contextId,
        options: body.config.options,
        exportFormats: body.config.exportFormats,
        createdAt: new Date(),
      };

      const result = await db.collection('generations').insertOne(generationRecord);
      const generationId = result.insertedId.toString();

      // Generate document based on type
      try {
        let generatorResponse;
        
        switch (body.type) {
          case 'solution':
            generatorResponse = generateSolutionDocument(program, context, body.config.options);
            break;
          case 'workflow':
            generatorResponse = generateWorkflowDiagram(program, context, body.config.options);
            break;
          case 'erd':
            generatorResponse = generateERDDiagram(program, context, body.config.options);
            break;
          default:
            // Default to solution document
            generatorResponse = generateSolutionDocument(program, context, body.config.options);
        }

        // Update generation record with result
        await db.collection('generations').updateOne(
          { _id: result.insertedId },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              result: generatorResponse,
            },
          }
        );

        // Return generated document
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            id: generationId,
            title: generatorResponse.title,
            type: body.type,
            content: generatorResponse.content,
            metadata: {
              program: program?.metadata?.name || program?.program_type,
              context: context?.customer?.name,
              generatedAt: new Date().toISOString(),
              version: '1.0',
              sections: generatorResponse.sections,
            },
            exports: body.config.exportFormats || ['markdown'],
          }),
        };
      } catch (error: any) {
        // Update generation record with error
        await db.collection('generations').updateOne(
          { _id: result.insertedId },
          {
            $set: {
              status: 'error',
              error: error.message,
              completedAt: new Date(),
            },
          }
        );

        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Generation failed', 
            details: error.message 
          }),
        };
      }
    }


    // GET /generators/history - Get generation history
    if (event.httpMethod === 'GET' && segments[0] === 'history') {
      const queryParams = event.queryStringParameters || {};
      const limit = parseInt(queryParams.limit || '50');
      const type = queryParams.type;

      const query: any = { userId: user.id || user._id };
      if (type) {
        query.type = type;
      }

      const generations = await db.collection('generations')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      // If no generations found, return empty array
      if (!generations || generations.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([]),
        };
      }

      // Transform to history items
      const history = await Promise.all(generations.map(async (gen) => {
        let programName = 'Unknown Program';
        let contextName = undefined;

        if (gen.programId) {
          const program = await db.collection('programs').findOne({ 
            _id: new ObjectId(gen.programId) 
          });
          programName = program?.metadata?.name || program?.program_type || 'Unknown Program';
        }

        if (gen.contextId) {
          const context = await db.collection('contexts').findOne({ 
            _id: new ObjectId(gen.contextId) 
          });
          contextName = context?.customer?.name;
        }

        return {
          id: gen._id.toString(),
          type: gen.type,
          title: gen.result?.title || `${programName} ${gen.type}`,
          programName,
          contextName,
          status: gen.status,
          createdAt: gen.createdAt,
          completedAt: gen.completedAt,
          exports: gen.exportFormats || [],
        };
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(history),
      };
    }

    // GET /generators/:id - Get generation status
    if (event.httpMethod === 'GET' && segments.length === 1) {
      const generation = await db.collection('generations').findOne({ 
        _id: new ObjectId(segments[0]),
        userId: user.id,
      });

      if (!generation) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Generation not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: generation._id.toString(),
          type: generation.type,
          status: generation.status,
          progress: generation.progress,
          message: generation.message,
          result: generation.result,
          error: generation.error,
          createdAt: generation.createdAt,
          completedAt: generation.completedAt,
        }),
      };
    }

    // POST /generators/:id/export - Export document in specific format
    if (event.httpMethod === 'POST' && segments[1] === 'export') {
      const body = JSON.parse(event.body || '{}');
      const format = body.format;

      if (!format) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing export format' }),
        };
      }

      const generation = await db.collection('generations').findOne({ 
        _id: new ObjectId(segments[0]),
        userId: user.id,
      });

      if (!generation || generation.status !== 'completed') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Generation not found or not completed' }),
        };
      }

      // Handle export directly (for now, return the content as-is)
      // In production, you would generate different formats here
      try {
        let exportContent = generation.result.content;
        let mimeType = 'text/markdown';
        
        // Handle different export formats
        switch (format) {
          case 'markdown':
            exportContent = generation.result.content;
            mimeType = 'text/markdown';
            break;
          case 'html':
            // Professional HTML export with comprehensive CSS styling
            const htmlContent = convertMarkdownToHTML(generation.result.content);
            const customCSS = body.options?.customCSS || '';
            
            exportContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generation.result.title}</title>
  <style>
    /* Base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    /* Typography */
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: #1a1a1a;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 0.5rem;
    }
    
    h2 {
      font-size: 2rem;
      font-weight: 600;
      margin-top: 2.5rem;
      margin-bottom: 1.2rem;
      color: #2c3e50;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 0.3rem;
    }
    
    h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #34495e;
    }
    
    h4 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.8rem;
      color: #495057;
    }
    
    p {
      margin-bottom: 1.2rem;
      text-align: justify;
    }
    
    /* Lists */
    ul, ol {
      margin-left: 2rem;
      margin-bottom: 1.2rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.95rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    th {
      background-color: #0066cc;
      color: white;
      font-weight: 600;
      text-align: left;
      padding: 12px 15px;
    }
    
    td {
      padding: 10px 15px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    
    tr:hover {
      background-color: #e8f4ff;
    }
    
    /* Code blocks */
    pre {
      background-color: #f6f8fa;
      border: 1px solid #d1d5da;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    
    code {
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      color: #d73a49;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
      color: inherit;
    }
    
    /* Mermaid diagrams */
    .mermaid {
      text-align: center;
      margin: 2rem 0;
      padding: 1rem;
      background-color: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid #0066cc;
      padding-left: 1rem;
      margin: 1.5rem 0;
      color: #666;
      font-style: italic;
    }
    
    /* Links */
    a {
      color: #0066cc;
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-bottom 0.2s;
    }
    
    a:hover {
      border-bottom: 1px solid #0066cc;
    }
    
    /* Document metadata */
    .document-meta {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    
    .document-meta strong {
      color: #495057;
      margin-right: 0.5rem;
    }
    
    /* Horizontal rule */
    hr {
      border: none;
      border-top: 2px solid #e0e0e0;
      margin: 3rem 0;
    }
    
    /* Print styles */
    @media print {
      body {
        max-width: 100%;
        padding: 1rem;
      }
      
      h1, h2, h3, h4 {
        page-break-after: avoid;
      }
      
      table, pre, blockquote {
        page-break-inside: avoid;
      }
      
      .document-meta {
        background-color: #f0f0f0;
        border: 1px solid #ccc;
      }
      
      th {
        background-color: #666;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      h2 {
        font-size: 1.5rem;
      }
      
      h3 {
        font-size: 1.25rem;
      }
      
      table {
        font-size: 0.85rem;
      }
      
      th, td {
        padding: 8px 10px;
      }
    }
    
    /* Custom styles */
    ${customCSS}
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
            mimeType = 'text/html';
            break;
          case 'json':
            exportContent = JSON.stringify(generation.result, null, 2);
            mimeType = 'application/json';
            break;
          default:
            exportContent = generation.result.content;
        }
        
        // For simplicity, we'll return the content directly
        // In production, you might upload to S3 and return a URL
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': mimeType,
          },
          body: JSON.stringify({
            content: exportContent,
            format: format,
            mimeType: mimeType,
          }),
        };
      } catch (error: any) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Export failed', 
            details: error.message 
          }),
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error: any) {
    console.error('Generator error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
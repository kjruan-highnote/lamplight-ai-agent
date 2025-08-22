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

// Generate solution document content
function generateSolutionDocument(program: any, context: any, options: any): any {
  const title = `${program?.metadata?.name || program?.program_type || 'API'} Solution Document`;
  
  const sections = [];
  
  // Executive Summary
  sections.push({
    title: 'Executive Summary',
    content: `This document outlines the solution architecture for ${program?.metadata?.name || program?.program_type || 'the API program'}${context ? ` tailored for ${context.customer?.name}` : ''}.`
  });
  
  // Program Overview
  if (program) {
    sections.push({
      title: 'Program Overview',
      content: `
**Program Type:** ${program.program_type || 'N/A'}
**Version:** ${program.metadata?.version || '1.0'}
**Description:** ${program.metadata?.description || 'No description provided'}

### Key Capabilities
${program.capabilities?.map((cap: any) => `- ${cap.name}: ${cap.description || 'No description'}`).join('\n') || '- No capabilities defined'}
      `.trim()
    });
  }
  
  // Customer Context
  if (context) {
    sections.push({
      title: 'Customer Context',
      content: `
**Customer:** ${context.customer?.name || 'N/A'}
**Industry:** ${context.customer?.industry || 'N/A'}
**Use Cases:** ${context.business_context?.use_cases?.join(', ') || 'N/A'}

### Requirements
${context.requirements?.functional?.map((req: string) => `- ${req}`).join('\n') || '- No functional requirements defined'}
      `.trim()
    });
  }
  
  // Workflows
  if (program?.workflows?.length > 0) {
    sections.push({
      title: 'Business Workflows',
      content: program.workflows.map((wf: any) => `
### ${wf.name}
${wf.description || 'No description'}

**Steps:**
${wf.steps?.map((step: any, idx: number) => `${idx + 1}. ${step.name}: ${step.description || 'No description'}`).join('\n') || 'No steps defined'}
      `).join('\n').trim()
    });
  }
  
  // Integration Details
  sections.push({
    title: 'Integration Details',
    content: `
### API Configuration
- **Base URL:** ${program?.api_config?.base_url || 'Not configured'}
- **Authentication:** ${program?.api_config?.authentication_type || 'Not specified'}
- **Rate Limiting:** ${program?.api_config?.rate_limiting ? 'Enabled' : 'Disabled'}

### Compliance
${program?.compliance?.standards?.map((std: string) => `- ${std}`).join('\n') || '- No compliance standards specified'}
    `.trim()
  });
  
  const content = sections.map(section => `## ${section.title}\n\n${section.content}`).join('\n\n---\n\n');
  
  return {
    title,
    content,
    sections: sections.map(s => s.title),
    metadata: {
      generatedAt: new Date().toISOString(),
      programType: program?.program_type,
      customerName: context?.customer?.name
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
            // Simple markdown to HTML conversion (basic)
            exportContent = `<!DOCTYPE html>
<html>
<head>
  <title>${generation.result.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3 { color: #333; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; }
  </style>
</head>
<body>
  <pre>${generation.result.content}</pre>
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
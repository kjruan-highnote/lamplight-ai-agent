import { Handler } from '@netlify/functions';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { connectToDatabase } from './db';

// Try multiple possible paths for the programs directory
const possiblePaths = [
  path.join(__dirname, '../../../../../ship-agent/data/programs'),
  path.join(process.cwd(), '../../ship-agent/data/programs'),
  path.join(process.cwd(), '../ship-agent/data/programs'),
  '/Users/kevinruan/Downloads/lamplight-ai-agent/agents/ship-agent/data/programs'
];

const PROGRAMS_DIR = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];

interface ProgramYAML {
  program_type: string;
  vendor: string;
  version: string;
  api_type: string;
  metadata?: {
    name: string;
    description: string;
    base_url?: string;
    authentication?: {
      type: string;
      header?: string;
    };
  };
  capabilities?: string[];
  workflows?: Record<string, any>;
  entities?: any[];
  categories?: any[];
  compliance?: any;
  integrations?: any;
  performance?: any;
  resources?: any;
  custom_capabilities?: any[];
}

// Helper functions
function determineClass(program: ProgramYAML): string {
  const programType = program.program_type.toLowerCase();
  
  if (programType.includes('template') || programType.includes('base')) {
    return 'template';
  }
  
  if (programType.includes('subscriber') || programType.includes('client')) {
    return 'subscriber';
  }
  
  // Check capabilities to determine class
  if (program.capabilities?.includes('on_demand_funding')) {
    return 'template';
  }
  
  return 'implementation';
}

function formatName(programType: string): string {
  return programType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateTags(program: ProgramYAML): string[] {
  const tags: string[] = [];
  
  // Add API type as tag
  if (program.api_type) {
    tags.push(program.api_type);
  }
  
  // Add vendor as tag
  if (program.vendor) {
    tags.push(program.vendor.toLowerCase().replace(/\s+/g, '-'));
  }
  
  // Add capability-based tags
  if (program.capabilities?.includes('on_demand_funding')) {
    tags.push('on-demand');
  }
  if (program.capabilities?.includes('prepaid_funding')) {
    tags.push('prepaid');
  }
  if (program.capabilities?.includes('credit_line_management')) {
    tags.push('credit');
  }
  if (program.capabilities?.includes('real_time_webhooks')) {
    tags.push('webhooks');
  }
  
  // Add compliance tags
  if (program.compliance?.standards?.some((s: any) => s.name === 'PCI_DSS')) {
    tags.push('pci-compliant');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

export const handler: Handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('programs');
    
    // Check if this is a single file import
    const body = event.body ? JSON.parse(event.body) : null;
    if (body && body.yamlContent) {
      // Handle single file import
      try {
        const programData = yaml.load(body.yamlContent) as ProgramYAML;
        
        // Validate required fields
        if (!programData.program_type || !programData.vendor) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
              error: 'Invalid YAML: Missing required fields (program_type or vendor)' 
            })
          };
        }
        
        // Create MongoDB document
        const document = {
          program_type: programData.program_type,
          vendor: programData.vendor,
          version: programData.version || '1.0.0',
          api_type: programData.api_type || 'graphql',
          program_class: determineClass(programData),
          status: 'active',
          metadata: programData.metadata || {
            name: formatName(programData.program_type),
            description: `${programData.vendor} ${formatName(programData.program_type)} Program`
          },
          capabilities: programData.capabilities || [],
          workflows: programData.workflows || {},
          entities: programData.entities || [],
          categories: programData.categories || [],
          compliance: programData.compliance || {},
          integrations: programData.integrations || {},
          performance: programData.performance || {},
          resources: programData.resources || {},
          custom_capabilities: programData.custom_capabilities || [],
          tags: generateTags(programData),
          source_file: body.fileName || 'uploaded.yaml',
          imported_at: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check if program already exists
        const existing = await collection.findOne({
          program_type: document.program_type,
          vendor: document.vendor
        });
        
        if (existing) {
          // Update existing program
          await collection.updateOne(
            { _id: existing._id },
            { 
              $set: {
                ...document,
                updatedAt: new Date()
              }
            }
          );
          
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              action: 'updated',
              program: document
            })
          };
        } else {
          // Insert new program
          const result = await collection.insertOne(document);
          
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              action: 'created',
              program: { ...document, _id: result.insertedId }
            })
          };
        }
      } catch (error: any) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          body: JSON.stringify({ 
            error: 'Failed to parse YAML',
            message: error.message 
          })
        };
      }
    }
    
    // Bulk import from directory
    
    // Check if programs directory exists
    if (!fs.existsSync(PROGRAMS_DIR)) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ 
          error: 'Programs directory not found',
          path: PROGRAMS_DIR 
        })
      };
    }
    
    // Get all YAML files
    const files = fs.readdirSync(PROGRAMS_DIR).filter(file => 
      file.endsWith('.yaml') || file.endsWith('.yml')
    );
    
    const results = {
      imported: [] as string[],
      updated: [] as string[],
      failed: [] as { file: string; error: string }[],
      skipped: [] as { file: string; reason: string }[]
    };
    
    for (const file of files) {
      const filePath = path.join(PROGRAMS_DIR, file);
      
      try {
        // Read and parse YAML file
        const content = fs.readFileSync(filePath, 'utf8');
        const programData = yaml.load(content) as ProgramYAML;
        
        // Validate required fields
        if (!programData.program_type || !programData.vendor) {
          results.skipped.push({ 
            file, 
            reason: 'Missing required fields (program_type or vendor)' 
          });
          continue;
        }
        
        // Create MongoDB document
        const document = {
          program_type: programData.program_type,
          vendor: programData.vendor,
          version: programData.version || '1.0.0',
          api_type: programData.api_type || 'graphql',
          program_class: determineClass(programData),
          status: 'active',
          metadata: programData.metadata || {
            name: formatName(programData.program_type),
            description: `${programData.vendor} ${formatName(programData.program_type)} Program`
          },
          capabilities: programData.capabilities || [],
          workflows: programData.workflows || {},
          entities: programData.entities || [],
          categories: programData.categories || [],
          compliance: programData.compliance || {},
          integrations: programData.integrations || {},
          performance: programData.performance || {},
          resources: programData.resources || {},
          custom_capabilities: programData.custom_capabilities || [],
          tags: generateTags(programData),
          source_file: file,
          imported_at: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check if program already exists
        const existing = await collection.findOne({
          program_type: document.program_type,
          vendor: document.vendor
        });
        
        if (existing) {
          // Update existing program
          await collection.updateOne(
            { _id: existing._id },
            { 
              $set: {
                ...document,
                updatedAt: new Date()
              }
            }
          );
          results.updated.push(file);
        } else {
          // Insert new program
          await collection.insertOne(document);
          results.imported.push(file);
        }
        
      } catch (error: any) {
        results.failed.push({ 
          file, 
          error: error.message || 'Unknown error' 
        });
      }
    }
    
    // Create indexes for better performance
    await collection.createIndex({ program_type: 1, vendor: 1 }, { unique: true });
    await collection.createIndex({ 'metadata.name': 1 });
    await collection.createIndex({ capabilities: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ tags: 1 });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        summary: {
          total: files.length,
          imported: results.imported.length,
          updated: results.updated.length,
          failed: results.failed.length,
          skipped: results.skipped.length
        },
        details: results
      })
    };
    
  } catch (error: any) {
    console.error('Import failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        error: 'Import failed',
        message: error.message 
      })
    };
  }
};
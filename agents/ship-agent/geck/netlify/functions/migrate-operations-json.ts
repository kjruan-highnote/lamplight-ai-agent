import { Handler } from '@netlify/functions';
import * as fs from 'fs';
import * as path from 'path';
import { connectToDatabase } from './db';
import { Operation } from '../../src/types';

interface OperationJson {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  required: boolean;
  description?: string;
}

interface CategoryJson {
  name: string;
  operations: OperationJson[];
}

interface OperationsFileJson {
  collection: string;
  program_type: string;
  extraction_date: string;
  total_operations: number;
  categories: CategoryJson[];
}

// Helper to generate a basic GraphQL query/mutation template based on operation name
function generateGraphQLTemplate(operation: OperationJson, category: string): string {
  const { name, type } = operation;
  
  // Try to infer parameters from operation name
  const hasId = name.toLowerCase().includes('get') || 
                name.toLowerCase().includes('update') || 
                name.toLowerCase().includes('delete') ||
                name.toLowerCase().includes('revoke');
  
  const hasInput = name.toLowerCase().includes('create') || 
                   name.toLowerCase().includes('update') ||
                   name.toLowerCase().includes('add');
  
  let template = '';
  
  if (type === 'mutation') {
    const params = [];
    if (hasId) params.push('$id: ID!');
    if (hasInput) params.push('$input: ${name}Input!');
    
    const paramStr = params.length > 0 ? `(${params.join(', ')})` : '';
    const argsStr = params.length > 0 
      ? `(${hasId ? 'id: $id' : ''}${hasId && hasInput ? ', ' : ''}${hasInput ? 'input: $input' : ''})`
      : '';
    
    template = `mutation ${name}${paramStr} {
  ${name.charAt(0).toLowerCase() + name.slice(1)}${argsStr} {
    id
    status
    message
  }
}`;
  } else if (type === 'query') {
    const params = [];
    if (hasId) params.push('$id: ID!');
    
    const paramStr = params.length > 0 ? `(${params.join(', ')})` : '';
    const argsStr = hasId ? '(id: $id)' : '';
    
    template = `query ${name}${paramStr} {
  ${name.charAt(0).toLowerCase() + name.slice(1)}${argsStr} {
    id
    # Add fields here
  }
}`;
  } else {
    // Subscription
    template = `subscription ${name} {
  ${name.charAt(0).toLowerCase() + name.slice(1)} {
    id
    # Add fields here
  }
}`;
  }
  
  return template;
}

// Parse variables from the generated template
function extractVariables(query: string): Record<string, any> {
  const variables: Record<string, any> = {};
  
  // Match variable declarations like ($id: ID!, $input: CreateInput!)
  const varRegex = /\$(\w+):\s*([^,\)]+)/g;
  let match;
  
  while ((match = varRegex.exec(query)) !== null) {
    const [, name, typeStr] = match;
    const type = typeStr.trim();
    
    variables[name] = {
      name,
      type,
      required: type.endsWith('!'),
      description: `Variable ${name} of type ${type}`
    };
  }
  
  return variables;
}

export const handler: Handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { db } = await connectToDatabase();
    const operationsCollection = db.collection('operations');
    
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Path to operations directory
    const operationsDir = body.directory || 
      '/Users/kevinruan/Downloads/lamplight-ai-agent/agents/ship-agent/data/operations';
    
    if (!fs.existsSync(operationsDir)) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Operations directory not found',
          path: operationsDir 
        })
      };
    }
    
    // Get all JSON files ending with _operations.json
    const files = fs.readdirSync(operationsDir).filter(file => 
      file.endsWith('_operations.json')
    );
    
    const results = {
      processed: [] as string[],
      inserted: 0,
      updated: 0,
      failed: [] as { file: string; error: string }[],
      totalOperations: 0
    };
    
    for (const file of files) {
      const filePath = path.join(operationsDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content) as OperationsFileJson;
        
        // Skip empty files
        if (!data.categories || data.categories.length === 0) {
          console.log(`Skipping empty file: ${file}`);
          continue;
        }
        
        const vendor = data.collection || 'Unknown';
        const programType = data.program_type;
        
        // Process each category
        for (const category of data.categories) {
          for (const op of category.operations) {
            try {
              // Generate GraphQL template
              const graphqlQuery = generateGraphQLTemplate(op, category.name);
              const variables = extractVariables(graphqlQuery);
              
              const operation: Operation = {
                name: op.name,
                type: op.type,
                category: category.name,
                description: op.description || `${op.name} operation for ${category.name}`,
                required: op.required,
                query: graphqlQuery,
                variables: variables,
                vendor: vendor,
                apiType: 'graphql',
                tags: [
                  programType,
                  category.name,
                  op.type,
                  op.required ? 'required' : 'optional',
                  vendor.toLowerCase().replace(/\s+/g, '-')
                ].filter(Boolean),
                source: 'import',
                documentation: `Imported from ${file}`,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              
              // Upsert operation
              const result = await operationsCollection.updateOne(
                { 
                  name: operation.name, 
                  vendor: operation.vendor,
                  category: operation.category 
                },
                { $set: operation },
                { upsert: true }
              );
              
              if (result.upsertedCount > 0) {
                results.inserted++;
              } else if (result.modifiedCount > 0) {
                results.updated++;
              }
              
              results.totalOperations++;
            } catch (opError: any) {
              console.error(`Error processing operation ${op.name}:`, opError);
            }
          }
        }
        
        results.processed.push(file);
        
      } catch (error: any) {
        results.failed.push({ 
          file, 
          error: error.message || 'Unknown error' 
        });
        console.error(`Failed to process ${file}:`, error);
      }
    }
    
    // Create indexes for better performance
    await operationsCollection.createIndex({ name: 1, vendor: 1, category: 1 }, { unique: true });
    await operationsCollection.createIndex({ category: 1 });
    await operationsCollection.createIndex({ type: 1 });
    await operationsCollection.createIndex({ tags: 1 });
    await operationsCollection.createIndex({ vendor: 1 });
    await operationsCollection.createIndex({ 'source': 1 });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Processed ${results.processed.length} files`,
        stats: {
          filesProcessed: results.processed.length,
          totalOperations: results.totalOperations,
          inserted: results.inserted,
          updated: results.updated,
          failed: results.failed.length
        },
        details: {
          processed: results.processed,
          failed: results.failed
        }
      })
    };
    
  } catch (error: any) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Migration failed',
        message: error.message 
      })
    };
  }
};
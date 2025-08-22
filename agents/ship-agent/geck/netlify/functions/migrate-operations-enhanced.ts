import { Handler } from '@netlify/functions';
import * as fs from 'fs';
import * as path from 'path';
import { connectToDatabase } from './db';
import { Operation, OperationVariable } from '../../src/types';

interface PostmanItem {
  name: string;
  request?: {
    body?: {
      graphql?: {
        query?: string;
        variables?: string;
      };
    };
  };
  item?: PostmanItem[];
}

interface PostmanCollection {
  info: {
    name: string;
  };
  item: PostmanItem[];
}

// Parse GraphQL query to extract operation name and type
function parseGraphQLOperation(query: string): { name: string; type: 'query' | 'mutation' | 'subscription' } | null {
  const queryMatch = query.match(/^(query|mutation|subscription)\s+(\w+)/m);
  if (queryMatch) {
    return {
      type: queryMatch[1] as 'query' | 'mutation' | 'subscription',
      name: queryMatch[2]
    };
  }
  return null;
}

// Extract variables with types from GraphQL query
function extractVariablesFromQuery(query: string): Record<string, OperationVariable> {
  const variables: Record<string, OperationVariable> = {};
  
  // Match variable declarations like ($id: ID!, $input: CreateInput!)
  const varRegex = /\$(\w+):\s*([^,\)]+)/g;
  let match;
  
  while ((match = varRegex.exec(query)) !== null) {
    const [, name, typeStr] = match;
    const type = typeStr.trim();
    const required = type.endsWith('!');
    const cleanType = type.replace(/!/g, '').trim();
    
    // Try to extract description from comments in the query
    const descRegex = new RegExp(`#\\s*\\$${name}:\\s*(.+)`, 'i');
    const descMatch = query.match(descRegex);
    
    variables[name] = {
      name,
      type: cleanType,
      required,
      description: descMatch ? descMatch[1].trim() : `Variable ${name} of type ${cleanType}`
    };
  }
  
  return variables;
}

// Parse example variables JSON to get default values
function parseExampleVariables(variablesStr: string): Record<string, any> {
  try {
    return JSON.parse(variablesStr);
  } catch {
    return {};
  }
}

// Flatten Postman collection items into a flat map
function flattenPostmanItems(items: PostmanItem[], operations: Map<string, any>, parentPath: string = ''): void {
  for (const item of items) {
    const currentPath = parentPath ? `${parentPath} > ${item.name}` : item.name;
    
    if (item.request?.body?.graphql?.query) {
      const parsed = parseGraphQLOperation(item.request.body.graphql.query);
      if (parsed) {
        operations.set(parsed.name, {
          name: parsed.name,
          displayName: item.name,
          type: parsed.type,
          query: item.request.body.graphql.query,
          variables: item.request.body.graphql.variables || '{}',
          path: currentPath
        });
      }
    }
    
    if (item.item && item.item.length > 0) {
      flattenPostmanItems(item.item, operations, currentPath);
    }
  }
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
    
    // Paths
    const operationsDir = body.operationsDir || 
      '/Users/kevinruan/Downloads/lamplight-ai-agent/agents/ship-agent/data/operations';
    const postmanDir = body.postmanDir || 
      '/Users/kevinruan/Downloads/lamplight-ai-agent/agents/ship-agent/data/postman';
    
    // Step 1: Load all Postman collections and build operation map
    const postmanOperations = new Map<string, Map<string, any>>();
    
    if (fs.existsSync(postmanDir)) {
      const postmanFiles = fs.readdirSync(postmanDir).filter(file => 
        file.endsWith('.postman_collection.json')
      );
      
      for (const file of postmanFiles) {
        const filePath = path.join(postmanDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const collection = JSON.parse(content) as PostmanCollection;
          
          // Extract program type from collection name
          const collectionName = collection.info.name
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w_]/g, '');
          
          const operations = new Map<string, any>();
          flattenPostmanItems(collection.item, operations);
          
          postmanOperations.set(collectionName, operations);
          console.log(`Loaded ${operations.size} operations from ${collection.info.name}`);
        } catch (error) {
          console.error(`Failed to parse Postman collection ${file}:`, error);
        }
      }
    }
    
    // Step 2: Process operations JSON files and match with Postman data
    const results = {
      processed: [] as string[],
      inserted: 0,
      updated: 0,
      failed: [] as { file: string; error: string }[],
      totalOperations: 0,
      missingQueries: [] as string[]
    };
    
    const operationFiles = fs.readdirSync(operationsDir).filter(file => 
      file.endsWith('_operations.json')
    );
    
    for (const file of operationFiles) {
      const filePath = path.join(operationsDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (!data.categories || data.categories.length === 0) {
          continue;
        }
        
        const vendor = data.collection || 'Unknown';
        const programType = data.program_type;
        
        // Find matching Postman collection
        const postmanOps = postmanOperations.get(programType) || 
                          postmanOperations.get(programType.replace(/_/g, '')) ||
                          new Map();
        
        // Process each category
        for (const category of data.categories) {
          for (const op of category.operations) {
            try {
              // Find the actual GraphQL query from Postman
              const postmanOp = postmanOps.get(op.name);
              
              let graphqlQuery = '';
              let variables: Record<string, OperationVariable> = {};
              let exampleVars: Record<string, any> = {};
              
              if (postmanOp) {
                graphqlQuery = postmanOp.query;
                variables = extractVariablesFromQuery(graphqlQuery);
                exampleVars = parseExampleVariables(postmanOp.variables);
                
                // Add default values from example
                Object.keys(variables).forEach(key => {
                  if (exampleVars[key] !== undefined) {
                    variables[key].defaultValue = exampleVars[key];
                  }
                });
              } else {
                // Log missing query
                results.missingQueries.push(`${op.name} (${vendor}/${category.name})`);
                
                // Generate a basic template as fallback
                if (op.type === 'mutation') {
                  graphqlQuery = `mutation ${op.name}($input: ${op.name}Input!) {
  ${op.name.charAt(0).toLowerCase() + op.name.slice(1)}(input: $input) {
    id
    success
    message
  }
}`;
                } else if (op.type === 'query') {
                  graphqlQuery = `query ${op.name}($id: ID) {
  ${op.name.charAt(0).toLowerCase() + op.name.slice(1)}(id: $id) {
    id
    # Add fields here
  }
}`;
                } else {
                  graphqlQuery = `subscription ${op.name} {
  ${op.name.charAt(0).toLowerCase() + op.name.slice(1)} {
    id
    # Add fields here
  }
}`;
                }
                variables = extractVariablesFromQuery(graphqlQuery);
              }
              
              const operation: Operation = {
                name: op.name,
                type: op.type,
                category: category.name,
                description: op.description || (postmanOp?.displayName || `${op.name} operation for ${category.name}`),
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
                source: postmanOp ? 'postman' : 'generated',
                documentation: postmanOp ? `Imported from Postman: ${postmanOp.path}` : `Generated template for ${file}`,
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
    await operationsCollection.createIndex({ name: 1 });
    await operationsCollection.createIndex({ category: 1 });
    await operationsCollection.createIndex({ type: 1 });
    await operationsCollection.createIndex({ tags: 1 });
    await operationsCollection.createIndex({ vendor: 1 });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Processed ${results.processed.length} files with actual GraphQL queries`,
        stats: {
          filesProcessed: results.processed.length,
          totalOperations: results.totalOperations,
          inserted: results.inserted,
          updated: results.updated,
          failed: results.failed.length,
          missingQueries: results.missingQueries.length
        },
        details: {
          processed: results.processed,
          failed: results.failed,
          missingQueries: results.missingQueries.slice(0, 20) // Show first 20 missing
        }
      })
    };
    
  } catch (error: any) {
    console.error('Enhanced migration failed:', error);
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
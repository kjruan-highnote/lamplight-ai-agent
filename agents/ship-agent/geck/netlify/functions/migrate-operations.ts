import { Handler } from '@netlify/functions';
import * as fs from 'fs';
import * as path from 'path';
import { connectToDatabase } from './db';

interface PostmanItem {
  name: string;
  request?: {
    method: string;
    body?: {
      mode: string;
      graphql?: {
        query: string;
        variables?: string;
      };
      raw?: string;
    };
    url?: {
      raw: string;
      host?: string[];
      path?: string[];
    };
    description?: string;
  };
  response?: any[];
}

interface PostmanCollection {
  info: {
    name: string;
    description?: string;
  };
  item: Array<{
    name: string;
    item?: PostmanItem[];
  }>;
}

// Helper to extract GraphQL operation type from query
function getOperationType(query: string): 'query' | 'mutation' | 'subscription' {
  const trimmed = query.trim();
  if (trimmed.startsWith('mutation')) return 'mutation';
  if (trimmed.startsWith('subscription')) return 'subscription';
  return 'query';
}

// Helper to extract operation name from GraphQL query
function getOperationName(query: string): string {
  // Match patterns like "query GetCard" or "mutation CreateCard($id: ID!)"
  const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
  if (match) return match[1];
  
  // Fallback: try to find the first field in the query
  const fieldMatch = query.match(/{\s*(\w+)/);
  if (fieldMatch) return fieldMatch[1];
  
  return 'UnnamedOperation';
}

// Helper to parse GraphQL variables from query
function parseVariables(query: string): Record<string, any> {
  const variables: Record<string, any> = {};
  
  // Match variable declarations like ($id: ID!, $name: String)
  const varRegex = /\$(\w+):\s*([^,\)]+)/g;
  let match;
  
  while ((match = varRegex.exec(query)) !== null) {
    const [, name, typeStr] = match;
    const required = typeStr.includes('!');
    const type = typeStr.replace('!', '').trim();
    
    variables[name] = {
      name,
      type,
      required,
      description: `Variable ${name} of type ${type}`
    };
  }
  
  return variables;
}

// Helper to parse variables from string (Postman format)
function parsePostmanVariables(variablesStr?: string): Record<string, any> {
  if (!variablesStr) return {};
  
  try {
    const parsed = JSON.parse(variablesStr);
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = {
        name: key,
        type: typeof value === 'string' ? 'String' : 
              typeof value === 'number' ? 'Int' : 
              typeof value === 'boolean' ? 'Boolean' : 'String',
        required: false,
        defaultValue: value
      };
    }
    
    return result;
  } catch {
    return {};
  }
}

// Convert Postman item to Operation
function convertPostmanToOperation(item: PostmanItem, category: string, vendor: string): any {
  const graphql = item.request?.body?.graphql;
  if (!graphql?.query) return null;
  
  const query = graphql.query;
  const operationType = getOperationType(query);
  const operationName = getOperationName(query);
  
  // Parse variables from both the query and the example
  const queryVariables = parseVariables(query);
  const exampleVariables = parsePostmanVariables(graphql.variables);
  
  // Merge variables, preferring query-defined types
  const variables = { ...exampleVariables, ...queryVariables };
  
  return {
    name: item.name || operationName,
    type: operationType,
    category: category.toLowerCase().replace(/\s+/g, '_'),
    description: item.request?.description || '',
    query: query,
    variables: variables,
    vendor: vendor,
    apiType: 'graphql',
    source: 'postman',
    postmanId: item.name,
    tags: [vendor.toLowerCase(), category.toLowerCase(), operationType],
    examples: graphql.variables ? [{
      name: 'Default',
      variables: JSON.parse(graphql.variables || '{}')
    }] : [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export const handler: Handler = async (event, context) => {
  // Handle CORS
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
    
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    if (body.postmanCollection) {
      // Handle direct Postman collection upload
      const collection = body.postmanCollection as PostmanCollection;
      const vendor = body.vendor || collection.info.name;
      
      const operations: any[] = [];
      
      // Process each category/folder in the collection
      for (const folder of collection.item) {
        if (folder.item) {
          for (const item of folder.item) {
            const operation = convertPostmanToOperation(item, folder.name, vendor);
            if (operation) {
              operations.push(operation);
            }
          }
        }
      }
      
      // Bulk insert operations
      if (operations.length > 0) {
        // Update or insert each operation
        const results = await Promise.all(
          operations.map(op => 
            operationsCollection.updateOne(
              { name: op.name, vendor: op.vendor },
              { $set: op },
              { upsert: true }
            )
          )
        );
        
        const inserted = results.filter(r => r.upsertedCount > 0).length;
        const updated = results.filter(r => r.modifiedCount > 0).length;
        
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: `Migrated ${operations.length} operations`,
            stats: {
              total: operations.length,
              inserted,
              updated,
              skipped: operations.length - inserted - updated
            }
          })
        };
      }
    } else if (body.scanDirectory) {
      // Scan directory for Postman collections (for server-side migration)
      const collectionsDir = path.join(__dirname, '../../../../../ship-agent/data/postman');
      
      if (!fs.existsSync(collectionsDir)) {
        return {
          statusCode: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Postman collections directory not found' })
        };
      }
      
      const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.json'));
      let totalOperations = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(collectionsDir, file), 'utf8');
        const collection = JSON.parse(content) as PostmanCollection;
        const vendor = collection.info.name;
        
        for (const folder of collection.item) {
          if (folder.item) {
            for (const item of folder.item) {
              const operation = convertPostmanToOperation(item, folder.name, vendor);
              if (operation) {
                const result = await operationsCollection.updateOne(
                  { name: operation.name, vendor: operation.vendor },
                  { $set: operation },
                  { upsert: true }
                );
                
                totalOperations++;
                if (result.upsertedCount > 0) totalInserted++;
                if (result.modifiedCount > 0) totalUpdated++;
              }
            }
          }
        }
      }
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: `Scanned ${files.length} collections`,
          stats: {
            collections: files.length,
            totalOperations,
            inserted: totalInserted,
            updated: totalUpdated
          }
        })
      };
    }
    
    // Create indexes for better performance
    await operationsCollection.createIndex({ name: 1, vendor: 1 }, { unique: true });
    await operationsCollection.createIndex({ category: 1 });
    await operationsCollection.createIndex({ type: 1 });
    await operationsCollection.createIndex({ tags: 1 });
    await operationsCollection.createIndex({ vendor: 1 });
    
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'No collection data provided' })
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
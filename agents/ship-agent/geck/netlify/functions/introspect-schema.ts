import { Handler } from '@netlify/functions';

// GraphQL introspection query to fetch schema
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface SchemaField {
  name: string;
  description?: string;
  type: any;
  args?: any[];
}

interface SchemaType {
  kind: string;
  name: string;
  description?: string;
  fields?: SchemaField[];
  inputFields?: any[];
  enumValues?: any[];
}

interface IntrospectionResult {
  __schema: {
    queryType: { name: string };
    mutationType: { name: string };
    subscriptionType?: { name: string };
    types: SchemaType[];
  };
}

// Parse type reference to get the actual type name and if it's required
function parseTypeRef(type: any): { name: string; required: boolean; isList: boolean } {
  let required = false;
  let isList = false;
  let currentType = type;

  while (currentType) {
    if (currentType.kind === 'NON_NULL') {
      required = true;
      currentType = currentType.ofType;
    } else if (currentType.kind === 'LIST') {
      isList = true;
      currentType = currentType.ofType;
    } else {
      return {
        name: currentType.name || 'Unknown',
        required,
        isList
      };
    }
  }

  return { name: 'Unknown', required, isList };
}

// Extract input types for a specific operation
function extractOperationInputs(
  operationName: string, 
  schema: IntrospectionResult,
  operationType: 'query' | 'mutation' | 'subscription'
): any {
  const typeName = operationType === 'query' 
    ? schema.__schema.queryType.name 
    : operationType === 'mutation'
    ? schema.__schema.mutationType.name
    : schema.__schema.subscriptionType?.name;

  console.log(`Looking for ${operationType} type: ${typeName}`);
  if (!typeName) {
    console.log('No type name found for operation type:', operationType);
    return null;
  }

  const rootType = schema.__schema.types.find(t => t.name === typeName);
  if (!rootType || !rootType.fields) {
    console.log('Root type not found or has no fields:', typeName);
    return null;
  }

  console.log(`Searching for operation: ${operationName} in ${rootType.fields.length} fields`);
  
  // First try exact match
  let operation = rootType.fields.find(f => f.name === operationName);
  
  // If not found, try case-insensitive match
  if (!operation) {
    operation = rootType.fields.find(f => 
      f.name.toLowerCase() === operationName.toLowerCase()
    );
  }
  
  // If still not found, try removing common prefixes/suffixes
  if (!operation) {
    // Remove common GraphQL operation prefixes
    const cleanedName = operationName
      .replace(/^(get|list|create|update|delete|remove|add|set)/i, '')
      .replace(/^(Query|Mutation|Subscription)/i, '');
    
    operation = rootType.fields.find(f => 
      f.name.toLowerCase().includes(cleanedName.toLowerCase()) ||
      cleanedName.toLowerCase().includes(f.name.toLowerCase())
    );
  }
  
  if (!operation) {
    console.log(`Operation ${operationName} not found. Available operations:`, 
      rootType.fields.slice(0, 10).map(f => f.name).join(', '));
    return null;
  }
  
  console.log(`Found operation: ${operation.name}`);
  
  if (!operation.args || operation.args.length === 0) {
    console.log(`Operation ${operationName} has no arguments`);
    return {}; // Return empty object for operations with no args instead of null
  }

  const inputs: Record<string, any> = {};

  for (const arg of operation.args) {
    const typeInfo = parseTypeRef(arg.type);
    const inputType = schema.__schema.types.find(t => t.name === typeInfo.name);

    inputs[arg.name] = {
      name: arg.name,
      type: typeInfo.name,
      required: typeInfo.required,
      isList: typeInfo.isList,
      description: arg.description || '',
      defaultValue: arg.defaultValue,
      fields: inputType?.inputFields ? extractInputFields(inputType, schema.__schema.types) : undefined
    };
  }

  return inputs;
}

// Recursively extract fields from input types
function extractInputFields(type: SchemaType, allTypes: SchemaType[]): Record<string, any> | undefined {
  if (!type.inputFields || type.inputFields.length === 0) return undefined;

  const fields: Record<string, any> = {};

  for (const field of type.inputFields) {
    const typeInfo = parseTypeRef(field.type);
    const fieldType = allTypes.find(t => t.name === typeInfo.name);
    
    fields[field.name] = {
      name: field.name,
      type: typeInfo.name,
      required: typeInfo.required,
      isList: typeInfo.isList,
      description: field.description || '',
      defaultValue: field.defaultValue,
      // Recursively extract nested input fields (limit depth to prevent infinite recursion)
      fields: fieldType?.inputFields && !typeInfo.name.startsWith('__') 
        ? extractInputFields(fieldType, allTypes) 
        : undefined
    };
  }

  return fields;
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
    const body = JSON.parse(event.body || '{}');
    const { apiKey, endpoint, operationName, operationType } = body;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'API key is required' })
      };
    }

    const graphqlEndpoint = endpoint || 'https://api.us.test.highnote.com/graphql';

    // Highnote uses Basic auth with base64 encoded API key
    // Try different authentication formats based on common patterns:
    // Format 1: apikey:  (API key as username, empty password)
    // Format 2: :apikey  (empty username, API key as password) 
    // We'll try Format 1 first as it's more common
    const trimmedApiKey = apiKey.trim();
    const encodedAuth = Buffer.from(`${trimmedApiKey}:`).toString('base64');

    console.log('Attempting to connect to:', graphqlEndpoint);
    console.log('Auth header format: Basic [base64_encoded_:apikey]');

    // Fetch schema using introspection
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedAuth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: INTROSPECTION_QUERY,
        variables: {}
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('API Response Status:', response.status);
      console.error('API Response:', errorBody);
      throw new Error(`Failed to fetch schema: ${response.statusText} (${response.status})`)
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const schema = result.data as IntrospectionResult;

    // If specific operation requested, extract its inputs
    if (operationName && operationType) {
      const inputs = extractOperationInputs(operationName, schema, operationType);
      
      if (inputs === null) {
        // Try different naming conventions
        const alternativeNames = [
          operationName,
          operationName.charAt(0).toLowerCase() + operationName.slice(1), // camelCase
          operationName.charAt(0).toUpperCase() + operationName.slice(1), // PascalCase
          operationName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''), // snake_case
        ];
        
        let foundInputs = null;
        let foundName = null;
        
        for (const altName of alternativeNames) {
          console.log(`Trying alternative name: ${altName}`);
          const altInputs = extractOperationInputs(altName, schema, operationType);
          if (altInputs !== null) {
            foundInputs = altInputs;
            foundName = altName;
            break;
          }
        }
        
        if (foundInputs !== null) {
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              operation: foundName,
              originalName: operationName,
              type: operationType,
              inputs: foundInputs
            })
          };
        }
        
        // If still not found, return error with helpful info
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: `Operation '${operationName}' not found in ${operationType} schema`,
            operation: operationName,
            type: operationType,
            inputs: null,
            hint: 'Check if the operation name matches exactly with the GraphQL schema'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          operation: operationName,
          type: operationType,
          inputs
        })
      };
    }

    // Otherwise, return summary of available operations
    const queryType = schema.__schema.types.find(t => t.name === schema.__schema.queryType.name);
    const mutationType = schema.__schema.types.find(t => t.name === schema.__schema.mutationType.name);
    const subscriptionType = schema.__schema.subscriptionType 
      ? schema.__schema.types.find(t => t.name === schema.__schema.subscriptionType!.name)
      : null;

    const summary = {
      queries: queryType?.fields?.map(f => ({
        name: f.name,
        description: f.description,
        deprecated: f.isDeprecated
      })) || [],
      mutations: mutationType?.fields?.map(f => ({
        name: f.name,
        description: f.description,
        deprecated: f.isDeprecated
      })) || [],
      subscriptions: subscriptionType?.fields?.map(f => ({
        name: f.name,
        description: f.description,
        deprecated: f.isDeprecated
      })) || []
    };

    // Also extract all input types for reference
    const inputTypes = schema.__schema.types
      .filter(t => t.kind === 'INPUT_OBJECT')
      .map(t => ({
        name: t.name,
        description: t.description,
        fields: t.inputFields?.map(f => ({
          name: f.name,
          type: parseTypeRef(f.type),
          description: f.description,
          defaultValue: f.defaultValue
        }))
      }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        summary,
        inputTypes,
        totalTypes: schema.__schema.types.length
      })
    };

  } catch (error: any) {
    console.error('Schema introspection failed:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Failed to introspect schema',
        message: error.message 
      })
    };
  }
};
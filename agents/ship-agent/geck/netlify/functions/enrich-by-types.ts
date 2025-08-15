import { Handler } from '@netlify/functions';

// Full schema introspection query
const SCHEMA_INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      types {
        name
        kind
        description
        inputFields {
          name
          description
          type {
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
          defaultValue
        }
        fields {
          name
          description
          type {
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
        enumValues {
          name
          description
        }
      }
    }
  }
`;

interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef;
}

interface InputField {
  name: string;
  description?: string;
  type: TypeRef;
  defaultValue?: any;
}

interface SchemaType {
  name: string;
  kind: string;
  description?: string;
  inputFields?: InputField[];
  fields?: any[];
  enumValues?: Array<{ name: string; description?: string }>;
}

// Parse type reference to get the actual type name and modifiers
function parseTypeRef(type: TypeRef): { name: string; required: boolean; isList: boolean; isListRequired: boolean } {
  let required = false;
  let isList = false;
  let isListRequired = false;
  let currentType = type;

  // First pass: check if the outer type is NON_NULL
  if (currentType.kind === 'NON_NULL') {
    required = true;
    currentType = currentType.ofType!;
  }

  // Second pass: check if it's a LIST
  if (currentType.kind === 'LIST') {
    isList = true;
    currentType = currentType.ofType!;
    
    // Check if list items are required
    if (currentType.kind === 'NON_NULL') {
      isListRequired = true;
      currentType = currentType.ofType!;
    }
  }

  // Final pass: get the actual type name
  return {
    name: currentType.name || 'Unknown',
    required,
    isList,
    isListRequired
  };
}

// Normalize type name for matching (remove !, [], whitespace)
function normalizeTypeName(typeName: string): string {
  return typeName
    .replace(/[\[\]!]/g, '') // Remove array brackets and required markers
    .trim();
}

// Extract input types from GraphQL query string
function extractInputTypesFromQuery(query: string): Set<string> {
  const inputTypes: Set<string> = new Set();
  
  // Match variable declarations like ($input: CreateAccountHolderInput!)
  // Updated regex to handle longer type names and any suffix pattern
  const varRegex = /\$\w+:\s*([A-Za-z_][A-Za-z0-9_]*[\[\]!]*)/g;
  let match;
  
  while ((match = varRegex.exec(query)) !== null) {
    const fullType = match[1];
    const normalizedType = normalizeTypeName(fullType);
    
    // Skip scalar types
    if (!normalizedType.match(/^(String|Int|Float|Boolean|ID)$/)) {
      inputTypes.add(normalizedType);
      console.log(`Extracted input type: ${normalizedType} from ${fullType}`);
    }
  }
  
  return inputTypes;
}

// Convert input fields to our schema format
function convertInputFieldsToSchema(
  inputFields: InputField[], 
  allTypes: Map<string, SchemaType>
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const field of inputFields) {
    const typeInfo = parseTypeRef(field.type);
    
    // Build the field schema
    const fieldSchema: any = {
      name: field.name,
      type: typeInfo.name,
      required: typeInfo.required,
      isList: typeInfo.isList,
      description: field.description || ''
    };
    
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      fieldSchema.defaultValue = field.defaultValue;
    }
    
    // If it's an enum, add the possible values
    const enumType = allTypes.get(typeInfo.name);
    if (enumType && enumType.kind === 'ENUM' && enumType.enumValues) {
      fieldSchema.enumValues = enumType.enumValues.map(ev => ev.name);
      if (enumType.description) {
        fieldSchema.typeDescription = enumType.description;
      }
    }
    
    // If it's an input object type, recursively add its fields
    const inputType = allTypes.get(typeInfo.name);
    if (inputType && inputType.kind === 'INPUT_OBJECT' && inputType.inputFields) {
      fieldSchema.fields = convertInputFieldsToSchema(inputType.inputFields, allTypes);
    }
    
    result[field.name] = fieldSchema;
  }
  
  return result;
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
    const { apiKey, endpoint, operations } = body;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'API key is required' })
      };
    }

    if (!operations || !Array.isArray(operations)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Operations array is required' })
      };
    }

    const graphqlEndpoint = endpoint || 'https://api.us.test.highnote.com/graphql';

    // Highnote uses Basic auth with base64 encoded API key
    const trimmedApiKey = apiKey.trim();
    const encodedAuth = Buffer.from(`${trimmedApiKey}:`).toString('base64');

    console.log('Fetching complete schema from GraphQL endpoint...');
    
    // Fetch the complete schema once
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedAuth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: SCHEMA_INTROSPECTION_QUERY,
        variables: {}
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch schema: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    if (!result.data?.__schema?.types) {
      throw new Error('Invalid schema response structure');
    }

    // Build a map of all types for quick lookup
    const allTypes = new Map<string, SchemaType>();
    for (const type of result.data.__schema.types) {
      allTypes.set(type.name, type);
    }

    console.log(`Schema loaded with ${allTypes.size} types`);

    // Process each operation
    const enrichedOperations: Record<string, any> = {};
    const errors: string[] = [];
    
    for (const operation of operations) {
      if (!operation.query) {
        errors.push(`Operation ${operation.name || 'unknown'} has no query`);
        continue;
      }

      // Extract input types from the operation's query
      const inputTypes = extractInputTypesFromQuery(operation.query);
      
      if (inputTypes.size === 0) {
        console.log(`No input types found in operation ${operation.name}`);
        continue;
      }

      console.log(`Operation ${operation.name} uses input types: ${Array.from(inputTypes).join(', ')}`);

      // Build the enriched schema for this operation
      const operationInputs: Record<string, any> = {};
      
      for (const typeName of inputTypes) {
        const type = allTypes.get(typeName);
        
        if (!type) {
          // Try case-insensitive match
          const found = Array.from(allTypes.entries()).find(
            ([name]) => name.toLowerCase() === typeName.toLowerCase()
          );
          
          if (found) {
            const [actualName, actualType] = found;
            console.log(`Found type ${actualName} (case-insensitive match for ${typeName})`);
            
            if (actualType.kind === 'INPUT_OBJECT' && actualType.inputFields) {
              operationInputs[typeName] = {
                actualTypeName: actualName,
                description: actualType.description,
                fields: convertInputFieldsToSchema(actualType.inputFields, allTypes)
              };
            } else {
              console.log(`Type ${actualName} found but is not INPUT_OBJECT (kind: ${actualType.kind})`);
            }
          } else {
            // Log available input types for debugging
            const availableInputTypes = Array.from(allTypes.entries())
              .filter(([_, t]) => t.kind === 'INPUT_OBJECT')
              .map(([name]) => name)
              .filter(name => name.toLowerCase().includes(typeName.toLowerCase().substring(0, 10)));
            
            console.log(`Type ${typeName} not found. Similar types: ${availableInputTypes.slice(0, 5).join(', ')}`);
            errors.push(`Type ${typeName} not found in schema for operation ${operation.name}`);
            
            // As a fallback, create a placeholder structure
            operationInputs[typeName] = {
              actualTypeName: typeName,
              description: `Type definition not found in schema`,
              fields: {
                _placeholder: {
                  name: '_placeholder',
                  type: 'Unknown',
                  required: false,
                  description: `Schema for ${typeName} could not be retrieved`
                }
              }
            };
          }
        } else if (type.kind === 'INPUT_OBJECT' && type.inputFields) {
          operationInputs[typeName] = {
            actualTypeName: typeName,
            description: type.description,
            fields: convertInputFieldsToSchema(type.inputFields, allTypes)
          };
        } else {
          console.log(`Type ${typeName} is not an INPUT_OBJECT (kind: ${type.kind})`);
          
          // Handle SCALAR and ENUM types
          if (type.kind === 'SCALAR' || type.kind === 'ENUM') {
            operationInputs[typeName] = {
              actualTypeName: typeName,
              description: type.description || `${type.kind} type`,
              fields: {
                _value: {
                  name: '_value',
                  type: typeName,
                  required: true,
                  description: `Direct ${type.kind.toLowerCase()} value`
                }
              }
            };
          }
        }
      }
      
      if (Object.keys(operationInputs).length > 0) {
        // Store with the operation ID or name as key
        const key = operation._id || operation.name;
        enrichedOperations[key] = {
          operationName: operation.name,
          inputs: operationInputs
        };
      }
    }

    // Build summary statistics
    const stats = {
      totalOperations: operations.length,
      enrichedCount: Object.keys(enrichedOperations).length,
      failedCount: errors.length,
      totalTypesInSchema: allTypes.size,
      inputTypesFound: Array.from(allTypes.values()).filter(t => t.kind === 'INPUT_OBJECT').length
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        enrichedOperations,
        stats,
        errors: errors.length > 0 ? errors : undefined
      })
    };
    
  } catch (error: any) {
    console.error('Failed to enrich types:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Failed to enrich types',
        message: error.message 
      })
    };
  }
};
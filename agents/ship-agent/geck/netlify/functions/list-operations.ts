import { Handler } from '@netlify/functions';

const INTROSPECTION_QUERY = `
  query ListOperations {
    __schema {
      queryType { 
        name 
        fields {
          name
          description
        }
      }
      mutationType { 
        name 
        fields {
          name
          description
        }
      }
      subscriptionType { 
        name 
        fields {
          name
          description
        }
      }
    }
  }
`;

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
    const body = JSON.parse(event.body || '{}');
    const { apiKey, endpoint } = body;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'API key is required' })
      };
    }

    const graphqlEndpoint = endpoint || 'https://api.us.test.highnote.com/graphql';

    // Highnote uses Basic auth with base64 encoded API key
    const trimmedApiKey = apiKey.trim();
    const encodedAuth = Buffer.from(`${trimmedApiKey}:`).toString('base64');

    console.log('Fetching available operations from:', graphqlEndpoint);

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
      throw new Error(`Failed to fetch schema: ${response.statusText} (${response.status})`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const schema = result.data.__schema;
    
    const operations = {
      queries: schema.queryType?.fields?.map((f: any) => ({
        name: f.name,
        description: f.description
      })) || [],
      mutations: schema.mutationType?.fields?.map((f: any) => ({
        name: f.name,
        description: f.description
      })) || [],
      subscriptions: schema.subscriptionType?.fields?.map((f: any) => ({
        name: f.name,
        description: f.description
      })) || []
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        operations,
        stats: {
          queries: operations.queries.length,
          mutations: operations.mutations.length,
          subscriptions: operations.subscriptions.length,
          total: operations.queries.length + operations.mutations.length + operations.subscriptions.length
        }
      })
    };
    
  } catch (error: any) {
    console.error('Failed to list operations:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Failed to list operations',
        message: error.message 
      })
    };
  }
};
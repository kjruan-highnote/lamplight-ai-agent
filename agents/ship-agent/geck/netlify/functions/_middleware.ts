import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Middleware wrapper for error logging
export const withErrorLogging = (handler: Handler): Handler => {
  return async (event: HandlerEvent, context: HandlerContext) => {
    const startTime = Date.now();
    const functionName = context.functionName || 'unknown';
    
    console.log(`[${new Date().toISOString()}] ${functionName} - ${event.httpMethod} ${event.path}`);
    
    if (event.queryStringParameters) {
      console.log(`Query params:`, event.queryStringParameters);
    }
    
    try {
      const response = await handler(event, context);
      const duration = Date.now() - startTime;
      
      console.log(`[${new Date().toISOString()}] ${functionName} - Status: ${response.statusCode} - Duration: ${duration}ms`);
      
      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      console.error(`[${new Date().toISOString()}] ${functionName} - ERROR after ${duration}ms:`, {
        message: error.message,
        stack: error.stack,
        event: {
          httpMethod: event.httpMethod,
          path: event.path,
          headers: event.headers,
          queryStringParameters: event.queryStringParameters,
          body: event.body ? event.body.substring(0, 1000) : null, // Log first 1000 chars of body
        }
      });
      
      // Return a proper error response
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
          timestamp: new Date().toISOString(),
        }),
      };
    }
  };
};
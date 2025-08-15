/**
 * Highnote Authentication Helper
 * 
 * Highnote uses Basic authentication with base64 encoding.
 * The API key is used as the username with an empty password.
 * Format: base64(apiKey + ':')
 */

/**
 * Encodes an API key for Highnote Basic authentication
 * @param apiKey - The raw API key from Highnote
 * @returns Base64 encoded string for Basic auth header
 */
export function encodeHighnoteApiKey(apiKey: string): string {
  // Highnote format: base64(apiKey + ':')
  // API key is used as username with empty password
  return btoa(`${apiKey}:`);
}

/**
 * Creates the full Authorization header value for Highnote
 * @param apiKey - The raw API key from Highnote
 * @returns Complete Authorization header value
 */
export function getHighnoteAuthHeader(apiKey: string): string {
  return `Basic ${encodeHighnoteApiKey(apiKey)}`;
}

/**
 * Creates headers object for Highnote GraphQL requests
 * @param apiKey - The raw API key from Highnote
 * @returns Headers object ready for fetch requests
 */
export function getHighnoteHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': getHighnoteAuthHeader(apiKey),
    'Accept': 'application/json'
  };
}

/**
 * Makes a GraphQL request to Highnote API
 * @param apiKey - The raw API key from Highnote
 * @param query - GraphQL query string
 * @param variables - GraphQL variables object
 * @param endpoint - Optional custom endpoint (defaults to test environment)
 */
export async function highnoteGraphQLRequest(
  apiKey: string,
  query: string,
  variables: Record<string, any> = {},
  endpoint: string = 'https://api.us.test.highnote.com/graphql'
): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getHighnoteHeaders(apiKey),
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Highnote API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result;
}
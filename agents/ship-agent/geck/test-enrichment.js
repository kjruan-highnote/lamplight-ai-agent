#!/usr/bin/env node

// Test script for enrichment workflow
// This tests both the introspect-schema and enrich-by-types endpoints

const testEnrichment = async () => {
  const API_KEY = process.env.HIGHNOTE_API_KEY || '';
  const BASE_URL = 'http://localhost:9000/.netlify/functions';
  
  if (!API_KEY) {
    console.error('Please set HIGHNOTE_API_KEY environment variable');
    process.exit(1);
  }
  
  console.log('Testing enrichment workflow...\n');
  
  // Test 1: Direct introspection for a known operation
  console.log('Test 1: Direct operation introspection');
  console.log('=====================================');
  try {
    const response = await fetch(`${BASE_URL}/introspect-schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: API_KEY,
        operationName: 'createAccountHolder',
        operationType: 'mutation'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ Direct introspection successful');
      console.log('Operation:', result.operation);
      console.log('Input parameters:', Object.keys(result.inputs || {}));
    } else {
      console.log('❌ Direct introspection failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n');
  
  // Test 2: Type-based enrichment from GraphQL query
  console.log('Test 2: Type-based enrichment from query');
  console.log('=========================================');
  
  const sampleOperation = {
    _id: 'test-op-1',
    name: 'CreateAccountHolder',
    type: 'mutation',
    query: `
      mutation CreateAccountHolder($input: CreateAccountHolderInput!) {
        createAccountHolder(input: $input) {
          id
          status
          accountHolder {
            id
            externalId
            status
          }
        }
      }
    `
  };
  
  try {
    const response = await fetch(`${BASE_URL}/enrich-by-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: API_KEY,
        operations: [sampleOperation]
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ Type-based enrichment successful');
      console.log('Stats:', result.stats);
      
      const enrichedOp = result.enrichedOperations['test-op-1'];
      if (enrichedOp) {
        console.log('Enriched operation:', enrichedOp.operationName);
        console.log('Input types found:', Object.keys(enrichedOp.inputs));
        
        // Show first few fields of the input type
        for (const [typeName, typeData] of Object.entries(enrichedOp.inputs)) {
          if (typeData.fields) {
            const fieldNames = Object.keys(typeData.fields).slice(0, 5);
            console.log(`  ${typeName} fields:`, fieldNames.join(', '), 
              fieldNames.length < Object.keys(typeData.fields).length ? '...' : '');
          }
        }
      }
    } else {
      console.log('❌ Type-based enrichment failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n');
  
  // Test 3: Schema summary
  console.log('Test 3: Schema summary');
  console.log('======================');
  try {
    const response = await fetch(`${BASE_URL}/introspect-schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: API_KEY
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ Schema summary successful');
      console.log(`Total types: ${result.totalTypes}`);
      console.log(`Queries: ${result.summary.queries.length}`);
      console.log(`Mutations: ${result.summary.mutations.length}`);
      console.log(`Input types: ${result.inputTypes.length}`);
      
      // Show a few operations
      console.log('\nSample queries:', result.summary.queries.slice(0, 3).map(q => q.name).join(', '));
      console.log('Sample mutations:', result.summary.mutations.slice(0, 3).map(m => m.name).join(', '));
    } else {
      console.log('❌ Schema summary failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

// Run the test
testEnrichment().catch(console.error);
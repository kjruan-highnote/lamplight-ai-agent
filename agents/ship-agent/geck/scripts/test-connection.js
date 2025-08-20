// Test MongoDB connection from Node.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/geck?authSource=admin';
const MONGODB_DB = process.env.MONGODB_DB || 'geck';

async function testConnection() {
  console.log('Testing MongoDB connection...');
  console.log('URI:', MONGODB_URI.replace(/\/\/[^@]+@/, '//***@'));
  console.log('Database:', MONGODB_DB);
  
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✓ Connected successfully!');
    
    const db = client.db(MONGODB_DB);
    
    // Test queries
    const collections = await db.listCollections().toArray();
    console.log('\nCollections:', collections.map(c => c.name).join(', '));
    
    const userCount = await db.collection('users').countDocuments();
    console.log('Users:', userCount);
    
    const contextCount = await db.collection('contexts').countDocuments();
    console.log('Contexts:', contextCount);
    
    const programCount = await db.collection('programs').countDocuments();
    console.log('Programs:', programCount);
    
    // Get sample data
    const sampleUser = await db.collection('users').findOne({});
    if (sampleUser) {
      console.log('\nSample user:', {
        email: sampleUser.email,
        name: sampleUser.name,
        role: sampleUser.role
      });
    }
    
    const sampleContext = await db.collection('contexts').findOne({});
    if (sampleContext) {
      console.log('\nSample context:', {
        customerName: sampleContext.customerName,
        industry: sampleContext.industry
      });
    }
    
    await client.close();
    console.log('\n✓ Connection test successful!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
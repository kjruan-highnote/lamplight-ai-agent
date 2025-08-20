import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.CONTEXT === 'dev' ||
                     process.env.NETLIFY_DEV === 'true';

// MongoDB connection configuration
const CONFIGURED_MONGODB_URI = process.env.MONGODB_URI || '';

// Use configured URI (which should include auth if needed)
let MONGODB_URI = CONFIGURED_MONGODB_URI;

if (!MONGODB_URI) {
  // Fallback to local MongoDB with auth if no URI is configured
  MONGODB_URI = 'mongodb://admin:password@localhost:27017/geck?authSource=admin';
  console.log('No MONGODB_URI configured, using default local MongoDB with auth');
}

if (isDevelopment) {
  console.log('Development mode: Connecting to MongoDB...');
}

const MONGODB_DB = process.env.MONGODB_DB || 'geck';

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    // Connect with the configured URI
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: isDevelopment ? 5000 : 10000, // Shorter timeout in dev
    });
    const db = client.db(MONGODB_DB);

    cachedClient = client;
    cachedDb = db;

    console.log(`Connected to MongoDB: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@').replace(/\?.*/, '')}`);
    return { client, db };
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}

export const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
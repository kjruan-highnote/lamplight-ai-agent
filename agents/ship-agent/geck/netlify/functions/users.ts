import { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB || 'geck';
const JWT_SECRET = process.env.JWT_SECRET || 'geck-secret-key-change-in-production';

// Verify JWT token and extract user
const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Check if user has permission
const hasPermission = (user: any, permission: string) => {
  if (user.role === 'admin') return true;
  // Add more permission checks as needed
  return false;
};

export const handler: Handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // In dev mode, bypass authentication entirely
  let currentUser: any = { id: 'dev-user', role: 'admin' };
  
  // Only check auth in production
  if (process.env.NODE_ENV !== 'development') {
    // Extract token from Authorization header
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    try {
      const token = authHeader.substring(7);
      currentUser = verifyToken(token);
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    // Check permission - only admins can manage users
    if (!hasPermission(currentUser, 'manageUsers')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden - Admin access required' }),
      };
    }
  }

  const client = new MongoClient(MONGODB_URI);
  const userId = event.queryStringParameters?.id;

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const collection = db.collection('users');

    switch (event.httpMethod) {
      case 'GET':
        if (userId) {
          // Get single user
          const user = await collection.findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } } // Exclude password
          );
          
          if (!user) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'User not found' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(user),
          };
        } else {
          // List all users
          const users = await collection.find(
            {},
            { projection: { password: 0 } } // Exclude passwords
          ).toArray();

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(users),
          };
        }

      case 'POST':
        if (event.path.includes('/toggle-active')) {
          // Toggle user active status
          const user = await collection.findOne({ _id: new ObjectId(userId) });
          if (!user) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'User not found' }),
            };
          }

          const result = await collection.updateOne(
            { _id: new ObjectId(userId) },
            { 
              $set: { 
                isActive: !user.isActive,
                updatedAt: new Date()
              }
            }
          );

          const updatedUser = await collection.findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } }
          );

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(updatedUser),
          };
        } else {
          // Create new user
          const data = JSON.parse(event.body || '{}');
          
          // Check if email already exists
          const existingUser = await collection.findOne({ email: data.email });
          if (existingUser) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Email already exists' }),
            };
          }

          // Hash password
          const hashedPassword = await bcrypt.hash(data.password, 10);
          
          const newUser = {
            ...data,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null,
          };

          const result = await collection.insertOne(newUser);
          
          // Return user without password
          const { password, ...userWithoutPassword } = newUser;
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              ...userWithoutPassword,
              _id: result.insertedId,
            }),
          };
        }

      case 'PUT':
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID required' }),
          };
        }

        const updateData = JSON.parse(event.body || '{}');
        
        // Don't allow password update through this endpoint
        delete updateData.password;
        
        // Check if email is being changed and if it's already taken
        if (updateData.email) {
          const existingUser = await collection.findOne({ 
            email: updateData.email,
            _id: { $ne: new ObjectId(userId) }
          });
          if (existingUser) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Email already exists' }),
            };
          }
        }

        const updateResult = await collection.updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: {
              ...updateData,
              updatedAt: new Date()
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        const updatedUser = await collection.findOne(
          { _id: new ObjectId(userId) },
          { projection: { password: 0 } }
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedUser),
        };

      case 'DELETE':
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID required' }),
          };
        }

        // Prevent deleting yourself (skip in dev mode)
        if (process.env.NODE_ENV !== 'development' && currentUser.id === userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Cannot delete your own account' }),
          };
        }

        const deleteResult = await collection.deleteOne({ _id: new ObjectId(userId) });
        
        if (deleteResult.deletedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        return {
          statusCode: 204,
          headers,
          body: '',
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Users API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  } finally {
    await client.close();
  }
};
import { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB || 'geck';
const JWT_SECRET = process.env.JWT_SECRET || 'geck-secret-key-change-in-production';

// Generate JWT token
const generateToken = (user: any) => {
  return jwt.sign(
    { 
      id: user._id.toString(), 
      email: user.email, 
      role: user.role,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify JWT token
const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch (error) {
    throw new Error('Invalid token');
  }
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

  const client = new MongoClient(MONGODB_URI);
  const path = event.path.replace('/.netlify/functions/auth', '');

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const collection = db.collection('users');

    switch (path) {
      case '/login':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
          };
        }

        const { email, password } = JSON.parse(event.body || '{}');

        if (!email || !password) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email and password required' }),
          };
        }

        // Find user by email
        const user = await collection.findOne({ email });
        
        if (!user) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid credentials' }),
          };
        }

        // Check if user is active
        if (!user.isActive) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Account is deactivated' }),
          };
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid credentials' }),
          };
        }

        // Update last login
        await collection.updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date() } }
        );

        // Generate token
        const token = generateToken(user);

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            user: userWithoutPassword,
            token,
          }),
        };

      case '/verify':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
          };
        }

        const { token: tokenToVerify } = JSON.parse(event.body || '{}');
        
        if (!tokenToVerify) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Token required' }),
          };
        }

        try {
          const decoded = verifyToken(tokenToVerify);
          
          // Get fresh user data
          const currentUser = await collection.findOne(
            { _id: new ObjectId(decoded.id) },
            { projection: { password: 0 } }
          );

          if (!currentUser) {
            return {
              statusCode: 401,
              headers,
              body: JSON.stringify({ error: 'User not found' }),
            };
          }

          if (!currentUser.isActive) {
            return {
              statusCode: 403,
              headers,
              body: JSON.stringify({ error: 'Account is deactivated' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(currentUser),
          };
        } catch (error) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid token' }),
          };
        }

      case '/register':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
          };
        }

        const registerData = JSON.parse(event.body || '{}');

        // Validate required fields
        if (!registerData.email || !registerData.password || !registerData.name) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email, password, and name are required' }),
          };
        }

        // Check if email already exists
        const existingUser = await collection.findOne({ email: registerData.email });
        if (existingUser) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email already registered' }),
          };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(registerData.password, 10);

        // Create new user
        const newUser = {
          ...registerData,
          password: hashedPassword,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: new Date(),
        };

        const result = await collection.insertOne(newUser);
        newUser._id = result.insertedId;

        // Generate token
        const newToken = generateToken(newUser);

        // Return user without password
        const { password: __, ...newUserWithoutPassword } = newUser;

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            user: newUserWithoutPassword,
            token: newToken,
          }),
        };

      case '/logout':
        // Logout is handled client-side by removing the token
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Logged out successfully' }),
        };

      case '/change-password':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
          };
        }

        // Extract token from Authorization header
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized' }),
          };
        }

        const authToken = authHeader.substring(7);
        let decoded;
        
        try {
          decoded = verifyToken(authToken);
        } catch (error) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid token' }),
          };
        }

        const { oldPassword, newPassword } = JSON.parse(event.body || '{}');

        if (!oldPassword || !newPassword) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Old and new passwords required' }),
          };
        }

        // Get user
        const userToUpdate = await collection.findOne({ _id: new ObjectId(decoded.id) });
        
        if (!userToUpdate) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        // Verify old password
        const isOldPasswordValid = await bcrypt.compare(oldPassword, userToUpdate.password);
        
        if (!isOldPasswordValid) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid old password' }),
          };
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await collection.updateOne(
          { _id: new ObjectId(decoded.id) },
          { 
            $set: { 
              password: hashedNewPassword,
              updatedAt: new Date()
            }
          }
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Password changed successfully' }),
        };

      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Endpoint not found' }),
        };
    }
  } catch (error) {
    console.error('Auth API error:', error);
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
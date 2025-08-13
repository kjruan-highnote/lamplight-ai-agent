import { Handler } from '@netlify/functions';
import { ObjectId } from 'mongodb';
import { connectToDatabase, headers } from './db';
import { withErrorLogging } from './_middleware';

const programHandler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('programs');
    const { id, search, program_type, tags, action } = event.queryStringParameters || {};

    switch (event.httpMethod) {
      case 'GET':
        if (id) {
          // Get single program
          let query: any = {};
          if (/^[0-9a-fA-F]{24}$/.test(id)) {
            query._id = new ObjectId(id);
          } else {
            query._id = id;
          }
          
          const program = await collection.findOne(query);
          
          if (!program) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Program not found' })
            };
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(program)
          };
        } else {
          // List programs with optional filters
          const query: any = {};
          
          if (search) {
            query.$or = [
              { name: { $regex: search, $options: 'i' } },
              { program_type: { $regex: search, $options: 'i' } },
              { 'config.metadata.name': { $regex: search, $options: 'i' } }
            ];
          }
          
          if (program_type) {
            query.program_type = program_type;
          }
          
          if (tags) {
            const tagArray = Array.isArray(tags) ? tags : tags.split(',');
            query.tags = { $in: tagArray };
          }
          
          const programs = await collection
            .find(query)
            .sort({ updatedAt: -1 })
            .toArray();
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(programs)
          };
        }

      case 'POST':
        if (action === 'duplicate' && id) {
          // Duplicate existing program
          const original = await collection.findOne({ 
            _id: new ObjectId(id) 
          });
          
          if (!original) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Program not found' })
            };
          }
          
          const { newName } = JSON.parse(event.body || '{}');
          const duplicate = {
            ...original,
            _id: new ObjectId(),
            name: newName || `${original.name}_copy`,
            program_type: `${original.program_type}_copy`,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await collection.insertOne(duplicate);
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ ...duplicate, _id: result.insertedId })
          };
        } else {
          // Create new program
          const data = JSON.parse(event.body || '{}');
          const newProgram = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await collection.insertOne(newProgram);
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ ...newProgram, _id: result.insertedId })
          };
        }

      case 'PUT':
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'ID required for update' })
          };
        }
        
        const updateData = JSON.parse(event.body || '{}');
        const { _id, ...dataToUpdate } = updateData;
        
        const updateResult = await collection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { 
            $set: {
              ...dataToUpdate,
              updatedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );
        
        if (!updateResult) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Program not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updateResult)
        };

      case 'DELETE':
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'ID required for delete' })
          };
        }
        
        const deleteResult = await collection.deleteOne({ 
          _id: new ObjectId(id) 
        });
        
        if (deleteResult.deletedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Program not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Program deleted successfully' })
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error: any) {
    console.error('Program API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};

export const handler = withErrorLogging(programHandler);
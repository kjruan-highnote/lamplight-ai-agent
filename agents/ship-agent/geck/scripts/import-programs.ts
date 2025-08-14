#!/usr/bin/env ts-node

/**
 * Script to import YAML program files from ship-agent/data/programs into MongoDB
 * Usage: npm run import-programs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const PROGRAMS_DIR = path.join(__dirname, '../../../../ship-agent/data/programs');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'geck';

interface ProgramYAML {
  program_type: string;
  vendor: string;
  version: string;
  api_type: string;
  metadata?: {
    name: string;
    description: string;
    base_url?: string;
    authentication?: {
      type: string;
      header?: string;
    };
  };
  capabilities?: string[];
  workflows?: Record<string, any>;
  entities?: any[];
  categories?: any[];
  compliance?: any;
  integrations?: any;
  performance?: any;
  resources?: any;
  custom_capabilities?: any[];
}

async function importPrograms() {
  console.log('🚀 Starting program import...');
  console.log(`📁 Programs directory: ${PROGRAMS_DIR}`);
  console.log(`🔗 MongoDB URI: ${MONGODB_URI}`);
  console.log(`📊 Database: ${DB_NAME}`);

  // Connect to MongoDB
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('programs');
    
    // Get all YAML files
    const files = fs.readdirSync(PROGRAMS_DIR).filter(file => 
      file.endsWith('.yaml') || file.endsWith('.yml')
    );
    
    console.log(`📄 Found ${files.length} YAML files to import`);
    
    const imported: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];
    
    for (const file of files) {
      const filePath = path.join(PROGRAMS_DIR, file);
      console.log(`\n📝 Processing: ${file}`);
      
      try {
        // Read and parse YAML file
        const content = fs.readFileSync(filePath, 'utf8');
        const programData = yaml.load(content) as ProgramYAML;
        
        // Validate required fields
        if (!programData.program_type || !programData.vendor) {
          console.log(`  ⚠️  Skipping: Missing required fields (program_type or vendor)`);
          skipped.push(file);
          continue;
        }
        
        // Create MongoDB document
        const document = {
          program_type: programData.program_type,
          vendor: programData.vendor,
          version: programData.version || '1.0.0',
          api_type: programData.api_type || 'graphql',
          program_class: determineClass(programData),
          status: 'active',
          metadata: programData.metadata || {
            name: formatName(programData.program_type),
            description: `${programData.vendor} ${formatName(programData.program_type)} Program`
          },
          capabilities: programData.capabilities || [],
          workflows: programData.workflows || {},
          entities: programData.entities || [],
          categories: programData.categories || [],
          compliance: programData.compliance || {},
          integrations: programData.integrations || {},
          performance: programData.performance || {},
          resources: programData.resources || {},
          custom_capabilities: programData.custom_capabilities || [],
          tags: generateTags(programData),
          source_file: file,
          imported_at: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check if program already exists
        const existing = await collection.findOne({
          program_type: document.program_type,
          vendor: document.vendor
        });
        
        if (existing) {
          // Update existing program
          const result = await collection.updateOne(
            { _id: existing._id },
            { 
              $set: {
                ...document,
                updatedAt: new Date()
              }
            }
          );
          console.log(`  ✅ Updated existing program (${document.program_type})`);
        } else {
          // Insert new program
          const result = await collection.insertOne(document);
          console.log(`  ✅ Imported as new program (ID: ${result.insertedId})`);
        }
        
        imported.push(file);
        
      } catch (error) {
        console.error(`  ❌ Failed to import: ${error.message}`);
        failed.push(file);
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${imported.length} programs`);
    console.log(`⚠️  Skipped: ${skipped.length} programs`);
    console.log(`❌ Failed: ${failed.length} programs`);
    
    if (imported.length > 0) {
      console.log('\n✅ Imported programs:');
      imported.forEach(f => console.log(`   - ${f}`));
    }
    
    if (skipped.length > 0) {
      console.log('\n⚠️  Skipped programs:');
      skipped.forEach(f => console.log(`   - ${f}`));
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed programs:');
      failed.forEach(f => console.log(`   - ${f}`));
    }
    
    // Create indexes for better performance
    console.log('\n📍 Creating indexes...');
    await collection.createIndex({ program_type: 1, vendor: 1 }, { unique: true });
    await collection.createIndex({ 'metadata.name': 1 });
    await collection.createIndex({ capabilities: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ tags: 1 });
    console.log('✅ Indexes created');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 MongoDB connection closed');
  }
}

// Helper functions
function determineClass(program: ProgramYAML): string {
  // Determine if it's a template or subscriber based on program characteristics
  const programType = program.program_type.toLowerCase();
  
  if (programType.includes('template') || programType.includes('base')) {
    return 'template';
  }
  
  if (programType.includes('subscriber') || programType.includes('client')) {
    return 'subscriber';
  }
  
  // Check capabilities to determine class
  if (program.capabilities?.includes('on_demand_funding')) {
    return 'template';
  }
  
  return 'implementation';
}

function formatName(programType: string): string {
  // Convert program_type to a readable name
  return programType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateTags(program: ProgramYAML): string[] {
  const tags: string[] = [];
  
  // Add API type as tag
  if (program.api_type) {
    tags.push(program.api_type);
  }
  
  // Add vendor as tag
  if (program.vendor) {
    tags.push(program.vendor.toLowerCase().replace(/\s+/g, '-'));
  }
  
  // Add capability-based tags
  if (program.capabilities?.includes('on_demand_funding')) {
    tags.push('on-demand');
  }
  if (program.capabilities?.includes('prepaid_funding')) {
    tags.push('prepaid');
  }
  if (program.capabilities?.includes('credit_line_management')) {
    tags.push('credit');
  }
  if (program.capabilities?.includes('real_time_webhooks')) {
    tags.push('webhooks');
  }
  
  // Add compliance tags
  if (program.compliance?.standards?.some((s: any) => s.name === 'PCI_DSS')) {
    tags.push('pci-compliant');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

// Run the import
importPrograms()
  .then(() => {
    console.log('\n✨ Import completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
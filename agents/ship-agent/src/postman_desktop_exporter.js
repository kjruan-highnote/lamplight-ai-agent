/**
 * Export collections from Postman Desktop App
 * 
 * Postman Desktop stores data locally, and this script can help export it
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class PostmanDesktopExporter {
    constructor() {
        // Postman desktop data locations
        this.postmanDataPaths = {
            mac: path.join(os.homedir(), 'Library/Application Support/Postman/IndexedDB'),
            windows: path.join(os.homedir(), 'AppData/Roaming/Postman/IndexedDB'),
            linux: path.join(os.homedir(), '.config/Postman/IndexedDB')
        };
    }

    /**
     * Get Postman data directory based on OS
     */
    getPostmanDataDir() {
        const platform = process.platform;
        
        if (platform === 'darwin') {
            return this.postmanDataPaths.mac;
        } else if (platform === 'win32') {
            return this.postmanDataPaths.windows;
        } else {
            return this.postmanDataPaths.linux;
        }
    }

    /**
     * Export collections using Postman's built-in export
     * This approach uses Postman's Collection SDK
     */
    async exportCollectionsViaSDK() {
        try {
            // Install these packages first:
            // npm install postman-collection postman-runtime
            const Collection = require('postman-collection').Collection;
            
            console.log('Note: For best results, use the Postman API method instead.');
            console.log('The Postman Desktop app data is encrypted and not easily accessible.');
            
        } catch (error) {
            console.error('Error:', error);
            console.log('\nRecommended approach:');
            console.log('1. Open Postman Desktop');
            console.log('2. For each collection, click ... -> Export');
            console.log('3. Or use the Postman API for automation');
        }
    }

    /**
     * Generate a batch export script for manual execution in Postman
     */
    generateBatchExportScript() {
        const script = `
// Postman Console Script for Batch Export
// Run this in Postman's console to export all collections

// 1. Open Postman Desktop
// 2. Open the console (View -> Show Postman Console)
// 3. Paste and run this script

const exportAllCollections = async () => {
    // Get all collections
    const collections = pm.collections.all();
    
    console.log(\`Found \${collections.length} collections\`);
    
    collections.forEach((collection, index) => {
        console.log(\`Exporting: \${collection.name}\`);
        
        // Note: Actual export requires manual action
        // This script lists all collections for manual export
        console.log(\`  ID: \${collection.id}\`);
        console.log(\`  Items: \${collection.items ? collection.items.length : 0}\`);
    });
    
    console.log('\\nTo export each collection:');
    console.log('1. Right-click on collection');
    console.log('2. Select "Export"');
    console.log('3. Choose Collection v2.1 format');
    console.log('4. Save to desired location');
};

exportAllCollections();
`;

        const scriptFile = path.join(__dirname, '../scripts/postman_batch_export.js');
        fs.writeFileSync(scriptFile, script);
        
        console.log(`Batch export script generated: ${scriptFile}`);
        console.log('\nInstructions:');
        console.log('1. Open Postman Desktop');
        console.log('2. Open Console (View -> Show Postman Console)');
        console.log('3. Copy and paste the script content');
        console.log('4. Follow the manual export instructions');
    }
}

// Main execution
const exporter = new PostmanDesktopExporter();

console.log('Postman Desktop Collection Exporter');
console.log('===================================\n');

console.log('Due to Postman Desktop\'s security model, automated export has limitations.\n');

console.log('Recommended approaches:');
console.log('1. Use Postman API (most reliable)');
console.log('   - Get API key from: https://postman.com/settings/me/api-keys');
console.log('   - Run: python3 postman_auto_exporter.py\n');

console.log('2. Manual batch export');
console.log('   - In Postman: Select all collections (Ctrl/Cmd+Click)');
console.log('   - Right-click -> Export\n');

console.log('3. Postman CLI');
console.log('   - Install: https://learning.postman.com/docs/postman-cli/postman-cli-installation/');
console.log('   - Run: postman collection list');
console.log('   - Run: postman collection export <id>\n');

// Generate helper script
exporter.generateBatchExportScript();

module.exports = PostmanDesktopExporter;
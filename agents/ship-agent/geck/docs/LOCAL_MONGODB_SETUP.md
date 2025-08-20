# Local MongoDB Setup for Development

This guide explains how to set up and use a local MongoDB instance when developing GECK.

## Overview

When running GECK in development mode, the application automatically attempts to use a local MongoDB instance (`mongodb://localhost:27017`) instead of the production database. This provides several benefits:

- **Faster Development**: No network latency to remote databases
- **Safe Testing**: No risk of affecting production data
- **Offline Development**: Work without internet connection
- **Cost Savings**: No cloud database usage charges

## Setup Instructions

### 1. Install MongoDB Locally

#### macOS (using Homebrew)
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
mongosh
```

#### Windows
Download and install MongoDB Community Server from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

#### Linux (Ubuntu/Debian)
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
```

### 2. Configure Environment Variables

Create a `.env.development.local` file in the project root:

```env
# Local MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=geck_dev

# Enable dev authentication
REACT_APP_USE_DEV_AUTH=true

# Auto-login as engineer (optional)
REACT_APP_DEV_AUTO_LOGIN=engineer
```

### 3. Run the Application

```bash
# Install dependencies
npm install

# Run with local MongoDB (as engineer)
npm run dev:engineer

# Or run with Netlify Dev (recommended)
netlify dev
```

## How It Works

The database connection logic (`netlify/functions/db.ts`) automatically:

1. **Detects Development Mode**: Checks for `NODE_ENV=development`, `NETLIFY_DEV=true`, or `CONTEXT=dev`
2. **Attempts Local Connection**: Tries to connect to `mongodb://localhost:27017` first
3. **Falls Back if Needed**: If local MongoDB is unavailable, falls back to configured `MONGODB_URI`
4. **Logs Connection Status**: Outputs which database is being used in the console

## Connection Priority

1. **In Development Mode**:
   - First tries: `mongodb://localhost:27017`
   - Falls back to: `MONGODB_URI` from environment variables

2. **In Production Mode**:
   - Always uses: `MONGODB_URI` from environment variables

## Troubleshooting

### MongoDB Not Starting

```bash
# Check if MongoDB is running
ps aux | grep mongod

# Check MongoDB logs (macOS)
tail -f /usr/local/var/log/mongodb/mongo.log

# Manually start MongoDB
mongod --dbpath /usr/local/var/mongodb
```

### Connection Refused

If you see "MongoServerError: connect ECONNREFUSED 127.0.0.1:27017":

1. Ensure MongoDB is running: `brew services list` (macOS)
2. Check if port 27017 is available: `lsof -i :27017`
3. Try connecting with mongosh: `mongosh mongodb://localhost:27017`

### Different Port

If MongoDB is running on a different port:

```env
# .env.development.local
MONGODB_URI=mongodb://localhost:27018
```

### Authentication Required

If your local MongoDB requires authentication:

```env
# .env.development.local
MONGODB_URI=mongodb://username:password@localhost:27017/geck_dev?authSource=admin
```

## Database Management

### View Local Database

```bash
# Connect to MongoDB shell
mongosh

# Switch to geck_dev database
use geck_dev

# Show collections
show collections

# View contexts
db.contexts.find().pretty()
```

### Reset Local Database

```bash
# Connect to MongoDB shell
mongosh

# Drop the development database
use geck_dev
db.dropDatabase()
```

### Export/Import Data

```bash
# Export from local
mongodump --db=geck_dev --out=./backup

# Import to local
mongorestore --db=geck_dev ./backup/geck_dev
```

## Dev User Roles

When using `REACT_APP_USE_DEV_AUTH=true`, you can log in as:

- **engineer@dev.local**: Technical Implementation Engineer
- **solutions@dev.local**: Solutions Engineer  
- **admin@dev.local**: System Administrator

All dev users use password: `dev`

## Best Practices

1. **Keep Local Data Separate**: Use `geck_dev` database name locally
2. **Don't Commit .env.development.local**: It's in .gitignore for a reason
3. **Regular Backups**: Export important test data before major changes
4. **Clean Slate Testing**: Periodically drop and recreate the database
5. **Monitor Logs**: Keep MongoDB logs open during development

## Scripts Reference

```bash
# Development with auto-login
npm run dev:engineer    # Auto-login as engineer
npm run dev:solutions   # Auto-login as solutions engineer
npm run dev:admin       # Auto-login as admin

# Development without auto-login
npm run dev             # Manual login required

# Production mode locally
npm run dev:prod        # Uses real authentication

# Netlify Dev (recommended)
netlify dev            # Runs both frontend and functions
```

## Security Note

The local MongoDB setup is intended for development only. Never use these configurations in production. Production databases should always:

- Use strong authentication
- Enable SSL/TLS
- Restrict network access
- Have regular backups
- Use connection pooling
- Monitor performance
# Docker MongoDB Setup

This guide explains how to run MongoDB in Docker for GECK development.

## Quick Start

### 1. Start MongoDB with Docker Compose

```bash
# Start MongoDB container (without authentication)
docker-compose up -d mongodb

# Or start MongoDB with web admin interface
docker-compose up -d

# Check if MongoDB is running
docker ps

# View MongoDB logs
docker logs geck-mongodb
```

### 2. Verify Connection

```bash
# Test connection with mongosh
mongosh mongodb://localhost:27017

# Or test with curl
curl http://localhost:27017
```

### 3. Run the Application

```bash
# Run with development authentication
npm run dev:engineer
```

## Docker Compose Configuration

The `docker-compose.yml` provides two services:

1. **mongodb**: MongoDB database server
2. **mongo-express**: Web-based MongoDB admin interface (optional)

### Without Authentication (Default - Recommended for Development)

The default configuration runs MongoDB without authentication:

```yaml
services:
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: geck
```

Connection string: `mongodb://localhost:27017`

### With Authentication (Optional)

To enable authentication, uncomment the environment variables in `docker-compose.yml`:

```yaml
environment:
  MONGO_INITDB_ROOT_USERNAME: admin
  MONGO_INITDB_ROOT_PASSWORD: password
  MONGO_INITDB_DATABASE: geck
```

Then update your `.env` file:
```env
MONGODB_URI=mongodb://admin:password@localhost:27017/?retryWrites=true&w=majority
```

## MongoDB Express Admin Interface

Access the web interface at: http://localhost:8081

This provides a GUI for:
- Viewing databases and collections
- Running queries
- Managing indexes
- Importing/exporting data

## Common Docker Commands

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v

# View logs
docker logs geck-mongodb -f

# Execute commands in container
docker exec -it geck-mongodb mongosh

# Backup database
docker exec geck-mongodb mongodump --db geck --archive > backup.archive

# Restore database
docker exec -i geck-mongodb mongorestore --archive < backup.archive
```

## Troubleshooting

### "Failed to load dashboard data" Error

This usually means MongoDB isn't running or the connection string is wrong.

1. **Check if MongoDB is running:**
   ```bash
   docker ps | grep mongodb
   ```

2. **Check MongoDB logs:**
   ```bash
   docker logs geck-mongodb
   ```

3. **Verify connection string in `.env`:**
   ```env
   # Should be without authentication:
   MONGODB_URI=mongodb://localhost:27017
   ```

4. **Test connection directly:**
   ```bash
   mongosh mongodb://localhost:27017/geck --eval "db.stats()"
   ```

### Port Already in Use

If port 27017 is already in use:

1. **Check what's using the port:**
   ```bash
   lsof -i :27017
   ```

2. **Stop existing MongoDB:**
   ```bash
   # If installed via Homebrew
   brew services stop mongodb-community
   
   # If running as Docker container
   docker stop $(docker ps -q --filter ancestor=mongo)
   ```

3. **Or change the port in docker-compose.yml:**
   ```yaml
   ports:
     - "27018:27017"  # Use port 27018 instead
   ```
   
   And update `.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27018
   ```

### Container Keeps Restarting

Check the logs for errors:
```bash
docker logs geck-mongodb --tail 50
```

Common issues:
- Insufficient disk space
- Permission issues with volumes
- Corrupted data files (remove volumes and restart)

### Cannot Connect from Application

1. **Ensure containers are on the same network:**
   ```bash
   docker network ls
   docker network inspect geck-network
   ```

2. **Check firewall settings:**
   - Ensure port 27017 is not blocked
   - Docker Desktop should handle this automatically

3. **Verify environment variables are loaded:**
   ```bash
   # In the project directory
   cat .env | grep MONGODB
   ```

## Data Persistence

MongoDB data is persisted in a Docker volume named `mongodb_data`. This survives container restarts but not `docker-compose down -v`.

### Backup Data

```bash
# Create backup
docker exec geck-mongodb mongodump --db geck --out /data/backup
docker cp geck-mongodb:/data/backup ./mongodb-backup

# Restore backup
docker cp ./mongodb-backup geck-mongodb:/data/backup
docker exec geck-mongodb mongorestore --db geck /data/backup/geck
```

### Reset Database

```bash
# Stop containers and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Development Workflow

1. **Start Docker MongoDB:**
   ```bash
   docker-compose up -d mongodb
   ```

2. **Run the application:**
   ```bash
   npm run dev:engineer  # Auto-login as engineer
   ```

3. **Monitor logs (optional):**
   ```bash
   # In a separate terminal
   docker logs geck-mongodb -f
   ```

4. **Access MongoDB Express (optional):**
   Open http://localhost:8081

5. **Stop when done:**
   ```bash
   docker-compose down
   ```

## Tips

- Use MongoDB Express for easy data inspection
- Keep `docker-compose down` (without `-v`) to preserve data between sessions
- Use `docker-compose logs -f` to monitor all services
- Create different `.env.local` files for different configurations
- Use Docker volumes for persistent data that survives container rebuilds
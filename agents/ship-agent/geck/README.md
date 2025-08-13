# G.E.C.K. - Garden of Eden Creation Kit

A Fallout-themed configuration management system for API integrations, built with React, TypeScript, and Netlify Functions.

## Features

- 🎮 **Vault-Tec Terminal UI** - Authentic Fallout terminal aesthetic with CRT effects
- 📝 **Context Management** - Create and edit customer contexts with JSON editor
- 🔧 **Program Configuration** - Build API program configs with YAML support
- 💾 **MongoDB Atlas** - Cloud database storage for all configurations
- ⚡ **Netlify Functions** - Serverless backend API
- 🔄 **Postman Sync** - Import and sync Postman collections
- 🎨 **Monaco Editor** - VS Code's editor for JSON/YAML editing

## Setup

### 1. MongoDB Atlas

1. Create a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account
2. Create a new cluster
3. Create a database called `geck`
4. Get your connection string from: Database → Connect → Drivers
5. Add your IP address to the Network Access list

### 2. Environment Variables

Create a `.env` file in the root directory:

```bash
# Copy from .env.example
cp .env.example .env
```

Edit `.env` with your credentials:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=geck
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
# Run with Netlify Dev (includes functions)
netlify dev

# Or run React app only
npm start
```

The app will be available at http://localhost:8888 (with Netlify Dev) or http://localhost:3000 (React only).

## Development

### Project Structure

```
geck/
├── src/                    # React app source
│   ├── components/         # UI components
│   ├── pages/             # Page components
│   ├── lib/               # API client
│   └── types/             # TypeScript types
├── netlify/functions/      # Serverless functions
│   ├── contexts.ts        # Context CRUD operations
│   ├── programs.ts        # Program CRUD operations
│   └── db.ts             # MongoDB connection
├── public/                # Static assets
└── build/                 # Production build
```

### Available Scripts

- `npm start` - Run React development server
- `npm run build` - Build for production
- `netlify dev` - Run with Netlify Functions locally
- `netlify deploy` - Deploy to Netlify

### API Endpoints

When running with `netlify dev`, the following endpoints are available:

- `GET /.netlify/functions/contexts` - List all contexts
- `GET /.netlify/functions/contexts?id=xxx` - Get single context
- `POST /.netlify/functions/contexts` - Create context
- `PUT /.netlify/functions/contexts?id=xxx` - Update context
- `DELETE /.netlify/functions/contexts?id=xxx` - Delete context

Same pattern applies for `/programs` endpoint.

## Deployment

### Deploy to Netlify

1. Push your code to GitHub
2. Connect your GitHub repo to Netlify
3. Set environment variables in Netlify:
   - Go to Site Settings → Environment Variables
   - Add `MONGODB_URI` and `MONGODB_DB`
4. Deploy!

### Manual Deploy

```bash
# Build and deploy
npm run build
netlify deploy --prod
```

## Technologies

- **Frontend**: React, TypeScript, Tailwind CSS
- **Editor**: Monaco Editor (VS Code)
- **Backend**: Netlify Functions (AWS Lambda)
- **Database**: MongoDB Atlas
- **Styling**: Tailwind CSS with custom Fallout theme
- **Deployment**: Netlify

## License

MIT

---

*War... War never changes.*
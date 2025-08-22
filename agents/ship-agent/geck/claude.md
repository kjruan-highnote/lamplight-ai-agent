# GECK Project Guide

## Overview

GECK (Garden of Eden Creation Kit) is a sophisticated configuration management system for API integrations, inspired by the Fallout universe aesthetic. The application provides a comprehensive platform for managing customer contexts, API program configurations, and operations with a unique retro-futuristic terminal interface.

## User Roles & Permissions

The application implements a role-based access control (RBAC) system with three primary user roles:

### 1. Technical Implementation Engineer
**Primary Users**: Engineers responsible for implementing and configuring API integrations
**Permissions**:
- **Contexts**: Full CRUD operations (Create, Read, Update, Delete, Duplicate)
- **Programs**: Full management including import capabilities
- **Operations**: Complete control including migration and deduplication
- **System**: Can sync Postman collections, generate solutions, access dashboard
- **Restrictions**: Cannot manage other users

### 2. Solutions Engineer
**Primary Users**: Engineers focused on solution architecture and client implementations
**Permissions**: Identical to Technical Implementation Engineer
- Full access to contexts, programs, and operations
- Can perform all technical operations
- Cannot manage users
- Designed for engineers who need complete technical access

### 3. System Administrator
**Primary Users**: System administrators and team leads
**Permissions**: Full system access including:
- All Technical Implementation Engineer permissions
- User management capabilities
- System configuration control
- Complete administrative access

### Authentication Flow

1. **Login**: Users authenticate with email/password
2. **Token Management**: JWT tokens stored in localStorage
3. **Session Persistence**: Tokens verified on app load
4. **Protected Routes**: Each route checks specific permissions
5. **Automatic Logout**: On token expiration or 401 responses

### Permission Structure

```typescript
interface UserPermissions {
  contexts: {
    view, create, edit, delete, duplicate
  };
  programs: {
    view, create, edit, delete, duplicate, import
  };
  operations: {
    view, create, edit, delete, migrate, deduplicate
  };
  system: {
    syncPostman, generateSolutions, manageUsers, 
    viewDashboard, configureSettings
  };
}
```

## Architecture

### Technology Stack

- **Frontend Framework**: React 19.1.1 with TypeScript 4.9.5
- **State Management**: Zustand 5.0.7 for lightweight state management
- **Styling**: Tailwind CSS 3.4.17 with custom theming system
- **Code Editor**: Monaco Editor (VS Code's editor) for JSON/YAML editing
- **Markdown**: React Markdown with GitHub Flavored Markdown support
- **Routing**: React Router DOM 7.8.0
- **Build Tool**: Create React App with CRACO for custom configuration
- **Backend**: Netlify Functions (serverless AWS Lambda)
- **Database**: MongoDB Atlas (cloud database)
- **HTTP Client**: Axios for API communications
- **Icons**: Lucide React for consistent iconography
- **Diagrams**: Mermaid for workflow visualizations

### Project Structure

```
geck/
├── src/                    # React application source
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Generic UI components (Button, Card, Modal, etc.)
│   │   ├── operation/     # Operation-specific components
│   │   ├── program/       # Program configuration components
│   │   └── workflow/      # Workflow management components
│   ├── pages/             # Page-level components (routes)
│   ├── lib/               # Core utilities and API client
│   ├── themes/            # Theming system with presets
│   ├── types/             # TypeScript type definitions
│   └── config/            # Application configuration
├── netlify/functions/      # Serverless backend functions
└── public/                # Static assets
```

## Code Style & Patterns

### TypeScript Conventions

1. **Strong Typing**: All data structures are fully typed using TypeScript interfaces
2. **Type Exports**: Types are centralized in `src/types/index.ts`
3. **Optional Properties**: Use `?` for optional fields, especially for database IDs and timestamps
4. **Union Types**: Leverage union types for constrained values (e.g., `'graphql' | 'rest' | 'soap'`)

### React Patterns

1. **Functional Components**: Exclusively use functional components with hooks
2. **Custom Hooks**: Extract complex logic into custom hooks when reusable
3. **Component Composition**: Favor composition over inheritance
4. **Props Interface**: Define explicit interfaces for all component props
5. **Forward Refs**: Use `forwardRef` for components that need ref access

### Component Architecture

```typescript
// Standard component structure
export interface ComponentProps {
  variant?: 'primary' | 'secondary';
  className?: string;
  children?: React.ReactNode;
}

export const Component: React.FC<ComponentProps> = ({ 
  variant = 'primary',
  className,
  children,
  ...props 
}) => {
  // Component logic
};
```

### Styling Approach

1. **Dynamic Theming**: Runtime theme switching via Context API
2. **CSS Variables**: Theme values applied as CSS custom properties
3. **Inline Styles**: Theme-aware inline styles for dynamic values
4. **Tailwind Utilities**: Used sparingly for layout and spacing
5. **Component Styles**: Encapsulated within components using CSSProperties

### Theme System

The application features a sophisticated theming system:

```typescript
interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    border: string;
    // ... comprehensive color palette
  };
  typography: {
    fontFamily: {
      base: string;
      mono: string;
      display: string;
    };
    fontSize: Record<string, string>;
  };
  spacing: Record<string, string>;
  borders: {
    width: Record<string, string>;
    radius: Record<string, string>;
  };
  effects: {
    shadow: Record<string, string>;
    transition: Record<string, string>;
    customEffects?: Record<string, any>;
  };
}
```

### API Client Pattern

Centralized API client using class-based structure:

```typescript
class ApiClient {
  private async request<T>(url: string, options: RequestInit = {}): Promise<T>
  
  contexts = {
    list: () => Promise<CustomerContext[]>,
    get: (id: string) => Promise<CustomerContext>,
    create: (data: CustomerContext) => Promise<CustomerContext>,
    update: (id: string, data: Partial<CustomerContext>) => Promise<CustomerContext>,
    delete: (id: string) => Promise<void>
  };
  // Similar structure for other resources
}
```

### State Management

- **Local State**: useState for component-level state
- **Global State**: Zustand for application-wide state
- **Server State**: Direct API calls with loading states
- **Theme State**: Context API for theme management

## Key Design Decisions

### 1. Serverless Architecture
- **Rationale**: Scalability, cost-effectiveness, and simplified deployment
- **Implementation**: Netlify Functions provide backend API without server management
- **Trade-offs**: Cold starts possible, but acceptable for this use case

### 2. MongoDB Atlas
- **Rationale**: Flexible schema for evolving data models, cloud-native
- **Implementation**: Direct MongoDB driver usage in serverless functions
- **Collections**: contexts, programs, operations, activity

### 3. Theme-First Design
- **Rationale**: Support multiple visual styles (Vault-Tec, Corporate, Cyberpunk)
- **Implementation**: Runtime theme switching with CSS variables
- **Benefits**: Customizable appearance, better UX for different preferences

### 4. Monaco Editor Integration
- **Rationale**: Professional code editing experience for YAML/JSON
- **Implementation**: @monaco-editor/react for seamless integration
- **Features**: Syntax highlighting, IntelliSense, validation

### 5. Component-Based Architecture
- **Rationale**: Reusability, maintainability, testability
- **Implementation**: Atomic design principles with UI component library
- **Structure**: ui/ for generic, domain/ for specific components

## Data Models

### Core Entities

1. **CustomerContext**: Comprehensive customer information including business context, use cases, requirements
2. **ProgramConfig**: API program configuration with workflows, capabilities, compliance
3. **Operation**: Individual API operations with GraphQL/REST support
4. **Workflow**: Business process definitions with visual diagrams

### Data Flow

1. Frontend components interact with API client (`lib/api.ts`)
2. API client makes requests to Netlify Functions
3. Functions connect to MongoDB Atlas for data persistence
4. Response flows back through the same chain

## Development Patterns

### Error Handling

```typescript
try {
  const result = await api.contexts.create(data);
  // Success handling
} catch (error) {
  console.error('Operation failed:', error);
  // User-friendly error display
}
```

### Loading States

```typescript
const [loading, setLoading] = useState(false);
const [data, setData] = useState<Type | null>(null);

useEffect(() => {
  setLoading(true);
  api.resource.get(id)
    .then(setData)
    .finally(() => setLoading(false));
}, [id]);
```

### Form Handling

- Controlled components with useState
- Validation before submission
- Optimistic updates where appropriate
- Error feedback to users

## Best Practices

### Code Organization

1. **Single Responsibility**: Each component/function has one clear purpose
2. **DRY Principle**: Avoid duplication through abstraction
3. **Consistent Naming**: camelCase for functions/variables, PascalCase for components/types
4. **File Structure**: Mirror component hierarchy in folder structure

### Performance

1. **Lazy Loading**: Route-based code splitting
2. **Memoization**: Use React.memo for expensive components
3. **Debouncing**: Search and filter operations
4. **Pagination**: Large data sets handled server-side

### Security

1. **Environment Variables**: Sensitive data in .env files
2. **Input Validation**: Both client and server-side
3. **Authentication**: API key based for external services
4. **CORS**: Properly configured for production

### Testing Strategy

1. **Unit Tests**: Jest + React Testing Library for components
2. **Integration Tests**: API endpoint testing
3. **Type Safety**: TypeScript catches many errors at compile time

## Deployment

### Local Development

```bash
npm install
npm start  # Runs both React app and Netlify Functions
```

#### Local MongoDB Support

The application automatically uses a local MongoDB instance when running in development mode:

- **Automatic Detection**: Detects development environment and connects to `mongodb://localhost:27017`
- **Fallback Logic**: If local MongoDB is unavailable, falls back to configured `MONGODB_URI`
- **Dev Authentication**: Use `REACT_APP_USE_DEV_AUTH=true` for mock authentication
- **Auto-login Options**: Can auto-login as engineer, solutions, or admin roles

See `docs/LOCAL_MONGODB_SETUP.md` for detailed setup instructions.

### Production Build

```bash
npm run build  # Creates optimized production build
netlify deploy --prod  # Deploy to Netlify
```

### Environment Configuration

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `MONGODB_DB`: Database name
- Additional API keys for integrations

## Common Patterns to Follow

### Creating New Components

1. Define TypeScript interface for props
2. Use functional component with explicit typing
3. Integrate with theme system via useTheme hook
4. Handle loading/error states appropriately
5. Export from index file for clean imports

### Adding New API Endpoints

1. Create function in `netlify/functions/`
2. Add corresponding methods in `lib/api.ts`
3. Define TypeScript types in `types/index.ts`
4. Handle errors gracefully with appropriate status codes

### Implementing Features

1. Start with data model design
2. Create API endpoints if needed
3. Build UI components bottom-up
4. Integrate with existing navigation
5. Add loading states and error handling
6. Test thoroughly before committing

## Theme Customization

The application supports multiple themes with comprehensive customization:

1. **Color Palette**: Primary, secondary, surface, text colors
2. **Typography**: Font families, sizes, weights
3. **Spacing**: Consistent spacing scale
4. **Effects**: Shadows, transitions, custom effects
5. **Dark Mode**: Built-in support via isDark flag

## Future Considerations

### Scalability

- Consider state management migration to Redux Toolkit if complexity grows
- Evaluate GraphQL client (Apollo) for GraphQL-heavy operations
- Implement caching strategy for frequently accessed data

### Features

- Real-time collaboration via WebSockets
- Advanced workflow visualization
- API mock server for testing
- Automated testing of configurations

### Performance

- Implement virtual scrolling for large lists
- Add service worker for offline capability
- Optimize bundle size with tree shaking

## Conclusion

This codebase prioritizes developer experience, maintainability, and user experience through:
- Strong typing with TypeScript
- Component-based architecture
- Comprehensive theming system
- Clean API abstractions
- Serverless architecture

When contributing, maintain these principles and patterns for consistency across the application.

## Megaton Integration Plan

**Related Project**: Megaton is located at `/Users/kevinruan/Documents/workspace/ts/megaton`

### Integration Overview
This plan outlines the integration of GECK into the Megaton platform - a comprehensive implementation management and customer success platform. Megaton currently uses Next.js, Context API for state management, and Google OAuth for authentication. This integration will bring GECK's advanced features to Megaton while preserving critical Megaton requirements.

### Megaton Overview
**Technology Stack:**
- Framework: Next.js 15.3.3 with React 19.1.0
- State Management: Context API with custom reducers
- Authentication: Google OAuth 2.0 (required)
- Styling: Tailwind CSS 3.0.24
- Backend: Netlify Functions + MongoDB Atlas

### Why This Integration?

**Megaton's Requirements:**
- Must maintain Google OAuth authentication
- Existing implementation projects and customer data must remain intact
- Current users should experience minimal disruption

**GECK Advantages to Bring:**
- **Zustand vs Context API:**
  - Simpler API with no providers, reducers, or action types
  - Better performance through selective subscriptions
  - Built-in DevTools integration
  - Easier testing with isolated stores
  - Eliminates provider hell
- **Advanced Theming**: Runtime switching with comprehensive customization
- **Enhanced RBAC**: More granular permission control
- **Modern Patterns**: Better TypeScript support and component architecture

### Integration Phases

#### Phase 1: Project Structure Setup (Week 1)
- Create `/features/geck/` directory in Megaton for GECK components
- Move GECK components preserving folder structure
- Create shared `/lib/geck/` for GECK's API client and utilities
- Set up module aliases for clean imports

#### Phase 2: Authentication Integration (Week 1-2)
- **Keep Google OAuth** as primary authentication (Megaton requirement)
- Enhance with GECK's RBAC system:
  - Map Google users to GECK roles post-authentication
  - Store role mappings in MongoDB
  - Create permission middleware combining both systems
- Unified user session structure:
```typescript
interface UnifiedUser {
  googleAuth: GoogleUserInfo;
  geckRole: 'tech_impl' | 'solutions' | 'admin';
  permissions: GeckPermissions;
}
```

#### Phase 3: State Management Migration (Week 2-3)
- Install Zustand in Megaton
- Create hybrid approach:
  - Keep GlobalStateContext for legacy Megaton features (temporary)
  - Use Zustand for new GECK features
  - Gradually migrate Megaton features to Zustand
- Benefits of migration:
  - Reduce re-renders and improve performance
  - Simplify state management code
  - Better developer experience

#### Phase 4: Theme System Evolution (Week 3)
- Start with Megaton's simple light/dark theme
- Create theme migration path:
  - Add GECK theme engine as opt-in feature
  - Support both theme systems during transition
  - Provide theme converter utilities
- Eventually adopt GECK's comprehensive theme system

#### Phase 5: Database & API Integration (Week 3-4)
- Shared MongoDB connection for both systems
- Namespace collections:
  - `megaton_*` for existing data
  - `geck_*` for GECK data
- Unified Netlify Functions structure
- Create data bridge for cross-system queries

#### Phase 6: Routing & Navigation (Week 4)
- Add GECK routes under `/geck/*` namespace
- Update navigation to include GECK sections
- Implement permission-based route guards
- Create seamless navigation between systems

#### Phase 7: Component Library Unification (Week 5)
- Create shared UI component library
- Standardize design tokens
- Implement consistent error/loading states
- Unify form handling patterns

### Key Design Decisions

#### User Management
- **Authentication**: Google OAuth (Megaton requirement - non-negotiable)
- **Authorization**: GECK's RBAC system layered on top
- **Session**: Unified token with both Google and GECK claims

#### State Management Strategy
- **Phase 1**: Dual system (Context API + Zustand)
- **Phase 2**: Gradual migration of features to Zustand
- **Phase 3**: Full Zustand adoption
- **Rationale**: Zustand's performance and DX benefits justify migration

#### Theming Approach
- **Initial**: Keep Megaton's theme for compatibility
- **Progressive**: Introduce GECK features gradually
- **Future**: Full GECK theme system adoption

#### Data Architecture
- **Database**: Shared MongoDB Atlas instance
- **Collections**: Namespaced for clarity and separation
- **APIs**: Unified Netlify Functions structure

### Target File Structure
```
megaton/
├── components/          # Existing Megaton components
├── features/
│   ├── geck/           # GECK module
│   │   ├── contexts/   # Customer contexts
│   │   ├── programs/   # API programs
│   │   ├── operations/ # Operations
│   │   └── ui/        # GECK UI components
│   └── shared/        # Shared features
├── lib/
│   ├── api/          # Unified API client
│   ├── geck/         # GECK utilities
│   └── auth/         # Auth integration
└── pages/
    ├── geck/         # GECK routes
    └── ...          # Existing routes
```

### Migration Path from Context API to Zustand

**Current Megaton State Management Issues:**
- Complex reducer boilerplate in GlobalStateContextProvider
- All consumers re-render on any state change
- Difficult to test in isolation
- Multiple nested providers causing "provider hell"

**Zustand Migration Benefits:**
```typescript
// Before (Context API)
const [state, dispatch] = useReducer(dataFetchReducer, initialState);
dispatch({ type: FETCH_ACTION, payload: data });

// After (Zustand)
const data = useStore(state => state.data);
const fetchData = useStore(state => state.fetchData);
```

### Benefits of This Integration
- **Non-disruptive**: Megaton continues functioning normally
- **Progressive**: Teams adopt GECK features at their pace
- **Performance**: Zustand improves app performance
- **Maintainable**: Clear separation of concerns
- **Scalable**: Foundation for future consolidation

### Critical Success Factors
1. Preserve Google OAuth requirement
2. Maintain backward compatibility
3. Document all breaking changes
4. Provide clear migration guides
5. Use feature flags for gradual rollout
6. Test thoroughly at each phase

### Notes for Implementation
- Start with non-critical features to validate approach
- Create adapters for bridging Context API and Zustand
- Maintain comprehensive test coverage during migration
- Set up monitoring to track performance improvements
- Regular team sync meetings to address concerns
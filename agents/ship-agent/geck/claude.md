# GECK Project Guide

## Overview

GECK (Garden of Eden Creation Kit) is a sophisticated configuration management system for API integrations, inspired by the Fallout universe aesthetic. The application provides a comprehensive platform for managing customer contexts, API program configurations, and operations with a unique retro-futuristic terminal interface.

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
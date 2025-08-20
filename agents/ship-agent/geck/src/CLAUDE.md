# GECK Source Code Guide

## Overview

This directory contains the React application source code for GECK (Garden of Eden Creation Kit), a sophisticated configuration management system for API integrations. The application is built with React 19.1.1, TypeScript, and follows a component-based architecture with strong typing throughout.

## Directory Structure

### `/components` - Reusable UI Components

The heart of the application's UI, containing all reusable components organized by domain.

#### `/components/ui` - Generic UI Components
- **Button.tsx**: Standard button component with variants (primary, secondary, danger, ghost)
- **Card.tsx**: Container component for content sections with consistent styling
- **Input.tsx**: Text input component with validation support
- **Modal.tsx**: Modal dialog component for overlays and forms
- **Select.tsx**: Dropdown select component with custom styling
- **Pagination.tsx**: Pagination controls for list views
- **ErrorBoundary.tsx**: React error boundary for graceful error handling

#### `/components/operation` - Operation Management Components
- **SchemaInputDisplay.tsx**: Displays and manages operation schemas
- **VariableManager.tsx**: Handles variable definitions and mappings for operations

#### `/components/program` - Program Configuration Components
- **CapabilitiesSelector.tsx**: UI for selecting program capabilities
- **CapabilityManager.tsx**: Manages capability configurations
- **OperationSelector.tsx**: Interface for selecting and configuring operations
- **WorkflowManager.tsx**: Visual workflow builder and editor

#### `/components/workflow` - Workflow Visualization
- **DiagramRenderer.tsx**: Renders Mermaid diagrams for workflow visualization

#### `/components/modals` - Specialized Modal Components
- **EnrichOperationsModal.tsx**: Modal for enriching operations with additional data

#### Core Components
- **Layout.tsx**: Main application layout with navigation sidebar
- **ProtectedRoute.tsx**: Route wrapper for authentication and authorization
- **VaultButton.tsx**: Specialized button with Vault-Tec styling
- **VaultInput.tsx**: Specialized input with Vault-Tec styling
- **VaultSelect.tsx**: Specialized select with Vault-Tec styling

### `/pages` - Page-Level Components

Contains all route-level components that represent full pages in the application.

- **Dashboard.tsx**: Main dashboard with statistics and recent activity
- **Login.tsx**: Authentication page with dev mode support
- **ContextsPage.tsx**: List view for customer contexts
- **ContextEditor.tsx**: Create/edit customer context configurations
- **ProgramsPage.tsx**: List view for API programs
- **ProgramEditor.tsx**: Create/edit program configurations
- **OperationsPage.tsx**: Manage API operations
- **PostmanSync.tsx**: Sync configurations with Postman
- **SolutionGenerator.tsx**: Generate solutions based on contexts
- **Settings.tsx**: Main settings page with navigation
- **UsersPage.tsx**: User management interface (admin only)

#### `/pages/settings` - Settings Subpages
- **ThemeSettings.tsx**: Theme selection and customization
- **ApiSettings.tsx**: API configuration and keys
- **DatabaseSettings.tsx**: Database connection settings (admin only)

### `/contexts` - React Context Providers

Global state management using React Context API.

- **AuthContext.tsx**: Authentication state and user management
  - Handles login/logout
  - Permission checking
  - Session management
  - Dev mode authentication
- **DevAuthContext.tsx**: Development authentication utilities
  - Mock users for testing
  - Quick role switching

### `/lib` - Core Libraries and Utilities

Essential utilities and API client implementations.

- **api.ts**: Centralized API client
  - RESTful API methods
  - Authentication handling
  - Error management
  - Resource-specific endpoints (contexts, programs, operations, users)
- **utils.ts**: Utility functions
  - Date formatting
  - String manipulation
  - Data transformation helpers
- **highnote-auth.ts**: Highnote-specific authentication logic

### `/themes` - Theming System

Comprehensive theming system for customizable UI appearance.

- **ThemeContext.tsx**: Theme provider and management
  - Runtime theme switching
  - Custom theme support
  - Theme persistence
- **types.ts**: TypeScript definitions for theme structure

#### `/themes/presets` - Built-in Themes
- **vault-tec.json**: Fallout-inspired retro-futuristic theme
- **corporate.json**: Professional business theme
- **cyberpunk.json**: Neon-lit futuristic theme
- **highnote.json**: Modern fintech theme with green accents
- **highnote-dark.json**: Dark mode version of Highnote theme

### `/types` - TypeScript Type Definitions

Central location for all TypeScript interfaces and types.

- **index.ts**: Contains all application-wide type definitions
  - User and authentication types
  - Customer context interfaces
  - Program configuration types
  - Operation definitions
  - Role-based permissions
  - API response types

### `/config` - Application Configuration

Static configuration files and constants.

- **capabilities.ts**: Defines available program capabilities and their metadata

### `/data` - Static Data and Samples

Sample data for development and testing.

- **sampleWorkflows.ts**: Example workflow configurations for testing

### `/hooks` - Custom React Hooks

Custom hooks for reusable logic (currently empty, ready for expansion).

### Root Files

- **App.tsx**: Main application component with routing
- **App.test.tsx**: Application test suite
- **index.tsx**: Application entry point
- **index.css**: Global CSS styles
- **output.css**: Compiled Tailwind CSS
- **setupProxy.js**: Development proxy configuration
- **setupTests.ts**: Test environment setup
- **reportWebVitals.ts**: Performance monitoring
- **react-app-env.d.ts**: TypeScript environment definitions
- **logo.svg**: Application logo

## Key Architectural Patterns

### Component Organization
- **Atomic Design**: UI components follow atomic design principles
- **Domain Grouping**: Components grouped by business domain
- **Single Responsibility**: Each component has one clear purpose

### State Management
- **Context API**: Global state via React Context
- **Local State**: Component-level state with useState
- **Server State**: Direct API calls with loading states

### Type Safety
- **Full TypeScript Coverage**: Every file is TypeScript
- **Strict Typing**: No implicit any types
- **Interface-First**: Define interfaces before implementation

### Code Style
- **Functional Components**: No class components
- **Hooks**: Modern React hooks patterns
- **Async/Await**: Consistent async handling

## Development Guidelines

### Adding New Components
1. Place in appropriate subdirectory
2. Create TypeScript interface for props
3. Use theme system for styling
4. Export from index file if creating component library

### Adding New Pages
1. Create in `/pages` directory
2. Add route in `App.tsx`
3. Implement authentication check if needed
4. Update navigation in `Layout.tsx`

### Working with Themes
1. Access theme via `useTheme()` hook
2. Use theme values for all colors/spacing
3. Support both light and dark modes
4. Test with multiple theme presets

### API Integration
1. Add methods to `lib/api.ts`
2. Define types in `types/index.ts`
3. Handle errors gracefully
4. Show loading states

## Common Tasks

### Creating a New Feature
1. Define types in `/types`
2. Create API endpoints in `/lib/api.ts`
3. Build components in `/components`
4. Create page in `/pages`
5. Add route and navigation

### Adding Authentication to a Route
1. Wrap with `ProtectedRoute` component
2. Define required permissions
3. Handle unauthorized access

### Customizing Theme
1. Edit theme preset in `/themes/presets`
2. Or create new theme JSON file
3. Import in `ThemeContext.tsx`
4. Add to defaultThemes array

## Testing Strategy

- **Unit Tests**: Component-level testing with React Testing Library
- **Integration Tests**: API integration testing
- **Type Checking**: TypeScript compilation as first test layer

## Performance Considerations

- **Code Splitting**: Routes are lazy-loaded
- **Memoization**: Use React.memo for expensive components
- **Virtual Scrolling**: For large lists (planned)
- **Image Optimization**: Lazy loading for images

## Security Notes

- **Authentication**: JWT-based with secure storage
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Client and server-side validation
- **XSS Prevention**: React's built-in protections
- **API Security**: Token-based authentication on all endpoints

## Future Expansion Areas

- `/hooks`: Custom hooks for shared logic
- `/services`: Business logic services
- `/workers`: Web workers for heavy computation
- `/i18n`: Internationalization support
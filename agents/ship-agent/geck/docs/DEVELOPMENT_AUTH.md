# Development Authentication Guide

## Quick Start

For rapid development without authentication friction:

```bash
# Copy the development environment file
cp .env.development .env.development.local

# Edit the file and set:
REACT_APP_USE_DEV_AUTH=true
REACT_APP_DEV_AUTO_LOGIN=engineer  # Auto-login as engineer on app load

# Start the development server
npm start
```

## Authentication Modes

### 1. **Dev Auth Mode** (Recommended for UI Development)
Enable mock authentication that accepts any credentials:

```env
REACT_APP_USE_DEV_AUTH=true
```

**Features:**
- Any email/password combination works
- Quick login buttons for each role
- No backend required for auth
- Instant role switching
- Persists across page refreshes

### 2. **Auto-Login Mode** (Fastest Development)
Automatically log in with a specific role on app load:

```env
REACT_APP_USE_DEV_AUTH=true
REACT_APP_DEV_AUTO_LOGIN=engineer  # or 'solutions' or 'admin'
```

**Use cases:**
- Developing specific features for a role
- Testing permission-based UI
- Rapid iteration without login steps

### 3. **Production Mode** (Testing Real Auth)
Use actual backend authentication:

```env
REACT_APP_USE_DEV_AUTH=false
# Or simply don't set it
```

## Quick Login Options

When `REACT_APP_USE_DEV_AUTH=true`, the login page shows quick login buttons:

- **Engineer Button**: Login as Technical Implementation Engineer
- **Solutions Button**: Login as Solutions Engineer
- **Admin Button**: Login as System Administrator

Or use email patterns:
- Email containing "admin" → Admin role
- Email containing "solution" → Solutions Engineer
- Any other email → Technical Implementation Engineer

## Mock Users

Three pre-configured users are available in dev mode:

### Technical Implementation Engineer
```javascript
{
  email: 'engineer@dev.local',
  name: 'Dev Engineer',
  role: 'technical_implementation_engineer',
  // Full access to contexts, programs, operations
  // Cannot manage users
}
```

### Solutions Engineer
```javascript
{
  email: 'solutions@dev.local',
  name: 'Dev Solutions',
  role: 'solutions_engineer',
  // Same permissions as Technical Implementation Engineer
}
```

### System Administrator
```javascript
{
  email: 'admin@dev.local',
  name: 'Dev Admin',
  role: 'admin',
  // Full system access including user management
}
```

## Development Workflows

### Scenario 1: UI Development
Focus on building UI without auth friction:

```env
REACT_APP_USE_DEV_AUTH=true
REACT_APP_DEV_AUTO_LOGIN=engineer
```

### Scenario 2: Permission Testing
Test different role permissions:

```env
REACT_APP_USE_DEV_AUTH=true
# Use quick login buttons to switch roles
```

### Scenario 3: Integration Testing
Test with real backend:

```env
REACT_APP_USE_DEV_AUTH=false
# Ensure backend is running
```

### Scenario 4: Demo Mode
Quick demos with instant access:

```env
REACT_APP_USE_DEV_AUTH=true
REACT_APP_DEV_AUTO_LOGIN=admin
```

## API Mocking (Optional)

For complete offline development, you can also mock API responses:

```env
REACT_APP_MOCK_API=true  # Coming soon
```

## Debugging

Enable permission debugging in console:

```env
REACT_APP_DEBUG_PERMISSIONS=true  # Coming soon
```

This will log:
- Permission checks
- Route access attempts
- Role changes
- Auth state updates

## Best Practices

1. **Use `.env.development.local`**: Never commit this file
2. **Role-Specific Development**: Use auto-login for the role you're developing for
3. **Test All Roles**: Before committing, test UI with all three roles
4. **Production Testing**: Periodically test with real auth to ensure compatibility
5. **Clear Storage**: If auth state gets corrupted, clear localStorage:
   ```javascript
   localStorage.clear()
   ```

## Troubleshooting

### Issue: Auto-login not working
**Solution**: Ensure both `REACT_APP_USE_DEV_AUTH=true` and `REACT_APP_DEV_AUTO_LOGIN` are set

### Issue: Can't access certain pages
**Solution**: Check if you're logged in with the right role. Admin pages need admin role.

### Issue: Auth state persists incorrectly
**Solution**: Clear localStorage and refresh:
```javascript
localStorage.removeItem('geck-auth-token');
localStorage.removeItem('geck-dev-user');
location.reload();
```

### Issue: Production auth in development
**Solution**: Check that `REACT_APP_USE_DEV_AUTH` is set to `true` in your `.env.development.local`

## Security Notes

⚠️ **Development auth is for development only!**

- Never enable `REACT_APP_USE_DEV_AUTH` in production
- The `.env.development.local` file should never be committed
- Mock auth bypasses all security checks
- Always test with real auth before deploying

## Environment File Template

Create `.env.development.local`:

```env
# MongoDB (if using backend)
MONGODB_URI=your_connection_string
MONGODB_DB=geck

# Development Auth
REACT_APP_USE_DEV_AUTH=true
REACT_APP_DEV_AUTO_LOGIN=engineer

# Optional Features
# REACT_APP_DEBUG_PERMISSIONS=true
# REACT_APP_MOCK_API=true
```

## Summary

The development authentication system provides multiple modes to match your workflow:

- **Quick Login**: One-click role switching
- **Auto-Login**: Skip login entirely
- **Mock Auth**: Any credentials work
- **Real Auth**: Test production flow

Choose the mode that best fits your current development task and switch as needed.
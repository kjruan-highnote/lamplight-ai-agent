# Development Scripts Quick Reference

## 🚀 Quick Start Commands

```bash
# Most Common - Start as engineer with mock auth
npm run quick

# Demo/Presentation - Start as admin
npm run demo

# Test Permissions - Manual role switching
npm run test:permissions
```

## 📋 Complete Script Reference

### Full Stack Development (App + Functions)

| Command | Description | Auto-Login | Backend |
|---------|-------------|------------|---------|
| `npm run dev:engineer` | Technical Implementation Engineer mode | ✅ Engineer | ✅ |
| `npm run dev:solutions` | Solutions Engineer mode | ✅ Solutions | ✅ |
| `npm run dev:admin` | Admin mode with full access | ✅ Admin | ✅ |
| `npm run dev` | Mock auth, manual login | ❌ | ✅ |
| `npm run dev:prod` | Production auth mode | ❌ | ✅ |
| `npm start` | Standard development (reads .env) | Depends | ✅ |

### Frontend Only Development

| Command | Description | Auto-Login | Backend |
|---------|-------------|------------|---------|
| `npm run app:engineer` | Frontend only, engineer role | ✅ Engineer | ❌ |
| `npm run app:solutions` | Frontend only, solutions role | ✅ Solutions | ❌ |
| `npm run app:admin` | Frontend only, admin role | ✅ Admin | ❌ |
| `npm run app:dev` | Frontend only, manual login | ❌ | ❌ |

### Utility Scripts

| Command | Description |
|---------|-------------|
| `npm run quick` | Alias for `dev:engineer` - fastest start |
| `npm run demo` | Alias for `dev:admin` - demo mode |
| `npm run test:permissions` | Alias for `dev` - test role switching |

## 🎯 Usage Scenarios

### Scenario 1: Daily Development
```bash
# Start quickly as engineer
npm run quick

# or specific role
npm run dev:solutions
```

### Scenario 2: UI/Component Development
```bash
# Frontend only - no backend needed
npm run app:engineer
```

### Scenario 3: Permission Testing
```bash
# Manual login to test different roles
npm run test:permissions
```

### Scenario 4: Demo/Presentation
```bash
# Start as admin for full feature demo
npm run demo
```

### Scenario 5: Integration Testing
```bash
# Test with real auth
npm run dev:prod
```

## 🔧 Environment Variables

These scripts automatically set the following environment variables:

- `REACT_APP_USE_DEV_AUTH` - Enables mock authentication
- `REACT_APP_DEV_AUTO_LOGIN` - Auto-login role (engineer/solutions/admin)
- `REACT_APP_SKIP_AUTH` - Skip auth entirely (use with caution)

## 💡 Tips

1. **Fastest Development**: Use `npm run quick` for immediate access
2. **Role Testing**: Use `npm run dev` and switch roles via UI
3. **Offline Work**: Use `app:*` scripts when backend isn't needed
4. **Production Testing**: Periodically test with `npm run dev:prod`

## 🎨 Role Capabilities

### Technical Implementation Engineer (`engineer`)
- Full access to contexts, programs, operations
- Can sync Postman, generate solutions
- Cannot manage users

### Solutions Engineer (`solutions`)
- Same as Technical Implementation Engineer
- Full operational access
- Cannot manage users

### System Administrator (`admin`)
- All engineer permissions
- User management access
- System configuration control

## ⚡ Command Aliases

For even faster access, add these to your shell profile:

```bash
# ~/.zshrc or ~/.bashrc
alias geck="npm run quick"
alias geck-admin="npm run dev:admin"
alias geck-demo="npm run demo"
alias geck-test="npm run test:permissions"
```

Then use:
```bash
geck          # Start as engineer
geck-admin    # Start as admin
geck-demo     # Demo mode
geck-test     # Test permissions
```

## 🔍 Debugging

If scripts aren't working:

1. **Check Node Version**: Ensure Node.js 16+ is installed
2. **Clear Cache**: `rm -rf node_modules && npm install`
3. **Check Ports**: Ensure ports 3000 and 9000 are free
4. **Reset Auth**: `localStorage.clear()` in browser console

## 📝 Notes

- All `dev:*` scripts include both frontend and backend
- All `app:*` scripts run frontend only (port 3000)
- Backend functions run on port 9000
- Scripts use `cross-env` for Windows compatibility
- Mock auth only works in development mode
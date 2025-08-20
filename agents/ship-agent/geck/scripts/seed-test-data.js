// MongoDB seed script for test data
// Run with: mongosh "mongodb://admin:password@localhost:27017/geck?authSource=admin" scripts/seed-test-data.js

// Check if we're connected
print("Connected to database:", db.getName());

// Create test users if they don't exist
const users = db.getCollection('users');
const userCount = users.countDocuments();
print("Existing users:", userCount);

if (userCount === 0) {
  print("Creating test users...");
  
  // Password hash for "dev" (bcrypt hash)
  const passwordHash = "$2a$10$8K1p/SJz7Y9dGYrNqD9W7OYv4Q0bXVXPXjXK.hYGKdOwDjE8KqGbm";
  
  const testUsers = [
    {
      email: "admin@geck.local",
      password: passwordHash,
      name: "Admin User",
      role: "admin",
      isActive: true,
      department: "Administration",
      createdAt: new Date(),
      lastLogin: new Date(),
      permissions: {
        contexts: { view: true, create: true, edit: true, delete: true, duplicate: true },
        programs: { view: true, create: true, edit: true, delete: true, duplicate: true, import: true },
        operations: { view: true, create: true, edit: true, delete: true, migrate: true, deduplicate: true },
        system: { syncPostman: true, generateSolutions: true, manageUsers: true, viewDashboard: true, configureSettings: true }
      }
    },
    {
      email: "engineer@geck.local",
      password: passwordHash,
      name: "Engineer User",
      role: "technical_implementation_engineer",
      isActive: true,
      department: "Engineering",
      createdAt: new Date(),
      lastLogin: new Date(),
      permissions: {
        contexts: { view: true, create: true, edit: true, delete: true, duplicate: true },
        programs: { view: true, create: true, edit: true, delete: true, duplicate: true, import: true },
        operations: { view: true, create: true, edit: true, delete: true, migrate: true, deduplicate: true },
        system: { syncPostman: true, generateSolutions: true, manageUsers: true, viewDashboard: true, configureSettings: true }
      }
    },
    {
      email: "solutions@geck.local",
      password: passwordHash,
      name: "Solutions Engineer",
      role: "solutions_engineer",
      isActive: true,
      department: "Solutions",
      createdAt: new Date(),
      lastLogin: new Date(),
      permissions: {
        contexts: { view: true, create: true, edit: true, delete: true, duplicate: true },
        programs: { view: true, create: true, edit: true, delete: true, duplicate: true, import: true },
        operations: { view: true, create: true, edit: true, delete: true, migrate: true, deduplicate: true },
        system: { syncPostman: true, generateSolutions: true, manageUsers: true, viewDashboard: true, configureSettings: true }
      }
    }
  ];
  
  const result = users.insertMany(testUsers);
  print("Created", result.insertedCount, "test users");
  print("Test users can login with password: 'dev'");
} else {
  print("Users already exist, skipping user creation");
}

// Add sample context if none exist
const contexts = db.getCollection('contexts');
if (contexts.countDocuments() === 0) {
  print("Creating sample context...");
  
  const sampleContext = {
    customerName: "Acme Corporation",
    industry: "Technology",
    businessModel: "B2B SaaS",
    description: "Leading provider of cloud-based enterprise solutions",
    keyRequirements: [
      "Real-time payment processing",
      "Multi-currency support",
      "Automated reconciliation"
    ],
    technicalStack: {
      backend: ["Node.js", "Python"],
      frontend: ["React", "TypeScript"],
      database: ["MongoDB", "PostgreSQL"],
      cloud: "AWS"
    },
    complianceRequirements: ["PCI DSS", "SOC 2", "GDPR"],
    integrationPoints: [
      { system: "Salesforce", type: "CRM" },
      { system: "Stripe", type: "Payments" }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  contexts.insertOne(sampleContext);
  print("Created sample context");
}

// Add sample program if none exist
const programs = db.getCollection('programs');
if (programs.countDocuments() === 0) {
  print("Creating sample program...");
  
  const sampleProgram = {
    name: "Payment Processing API",
    vendor: "Highnote",
    category: "Payments",
    description: "Complete payment processing solution with card issuance",
    capabilities: [
      "Card Issuance",
      "Transaction Processing",
      "Fraud Detection",
      "Webhook Notifications"
    ],
    apiType: "REST",
    authentication: {
      type: "OAuth2",
      scopes: ["payments:read", "payments:write", "cards:manage"]
    },
    rateLimits: {
      requests: 1000,
      period: "minute"
    },
    compliance: ["PCI DSS Level 1"],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  programs.insertOne(sampleProgram);
  print("Created sample program");
}

// Add sample activity
const activity = db.getCollection('activity');
if (activity.countDocuments() === 0) {
  print("Creating sample activity...");
  
  const sampleActivities = [
    {
      action: "context.created",
      resource: "Context",
      resourceId: contexts.findOne()._id,
      user: "admin@geck.local",
      details: { customerName: "Acme Corporation" },
      timestamp: new Date(Date.now() - 86400000) // 1 day ago
    },
    {
      action: "program.updated",
      resource: "Program",
      resourceId: programs.findOne()._id,
      user: "engineer@geck.local",
      details: { field: "capabilities", added: "Real-time Analytics" },
      timestamp: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      action: "user.login",
      resource: "Auth",
      user: "admin@geck.local",
      details: { ip: "127.0.0.1" },
      timestamp: new Date()
    }
  ];
  
  activity.insertMany(sampleActivities);
  print("Created sample activities");
}

// Display summary
print("\n=== Database Summary ===");
print("Users:", users.countDocuments());
print("Contexts:", contexts.countDocuments());
print("Programs:", programs.countDocuments());
print("Operations:", db.operations.countDocuments());
print("Activities:", activity.countDocuments());
print("\n✓ Test data setup complete!");
print("You can login with:");
print("  - admin@geck.local / dev");
print("  - engineer@geck.local / dev");
print("  - solutions@geck.local / dev");
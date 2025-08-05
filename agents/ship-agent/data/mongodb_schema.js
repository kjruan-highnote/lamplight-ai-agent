// MongoDB Schema for Ship Agent Operations Storage

// Database: ship_agent

// Collection: operations
// Stores all GraphQL queries and mutations
db.createCollection("operations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "program_type", "operation_type", "graphql"],
      properties: {
        name: {
          bsonType: "string",
          description: "Operation name (e.g., CreateUSPersonAccountHolder)"
        },
        program_type: {
          bsonType: "string",
          description: "Program type (e.g., consumer_credit, commercial_credit)"
        },
        operation_type: {
          enum: ["query", "mutation"],
          description: "GraphQL operation type"
        },
        graphql: {
          bsonType: "object",
          required: ["query"],
          properties: {
            query: {
              bsonType: "string",
              description: "GraphQL query or mutation string"
            },
            variables: {
              bsonType: "object",
              description: "Template variables with placeholders"
            }
          }
        },
        headers: {
          bsonType: "object",
          description: "HTTP headers for the request"
        },
        metadata: {
          bsonType: "object",
          properties: {
            category: {
              bsonType: "string",
              description: "Operation category (e.g., onboarding, issuance)"
            },
            description: {
              bsonType: "string"
            },
            requires: {
              bsonType: "array",
              items: {
                bsonType: "string"
              },
              description: "Required input fields or prerequisites"
            },
            produces: {
              bsonType: "array",
              items: {
                bsonType: "string"
              },
              description: "Output fields produced by this operation"
            },
            tags: {
              bsonType: "array",
              items: {
                bsonType: "string"
              }
            }
          }
        },
        version: {
          bsonType: "string",
          description: "Version of this operation"
        },
        created_at: {
          bsonType: "date"
        },
        updated_at: {
          bsonType: "date"
        }
      }
    }
  }
});

// Create indexes for efficient querying
db.operations.createIndex({ "name": 1, "program_type": 1 }, { unique: true });
db.operations.createIndex({ "program_type": 1 });
db.operations.createIndex({ "metadata.category": 1 });
db.operations.createIndex({ "metadata.tags": 1 });

// Collection: program_contexts
// Stores context and patterns learned from various sources
db.createCollection("program_contexts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["program_type", "source_type"],
      properties: {
        program_type: {
          bsonType: "string"
        },
        customer: {
          bsonType: "string",
          description: "Customer name if customer-specific"
        },
        source_type: {
          enum: ["postman", "confluence", "manual", "generated"],
          description: "Where this context came from"
        },
        patterns: {
          bsonType: "object",
          description: "Extracted patterns from the source"
        },
        examples: {
          bsonType: "array",
          items: {
            bsonType: "object"
          },
          description: "Example requests and responses"
        },
        rules: {
          bsonType: "object",
          description: "Business rules and validations"
        },
        created_at: {
          bsonType: "date"
        },
        updated_at: {
          bsonType: "date"
        }
      }
    }
  }
});

db.program_contexts.createIndex({ "program_type": 1, "customer": 1 });
db.program_contexts.createIndex({ "source_type": 1 });

// Collection: operation_templates
// Stores reusable templates for common patterns
db.createCollection("operation_templates", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["template_name", "template_type"],
      properties: {
        template_name: {
          bsonType: "string"
        },
        template_type: {
          enum: ["query", "mutation", "fragment", "variable_set"]
        },
        template: {
          bsonType: "object",
          description: "The template content"
        },
        applicable_to: {
          bsonType: "array",
          items: {
            bsonType: "string"
          },
          description: "Program types this template applies to"
        },
        tags: {
          bsonType: "array",
          items: {
            bsonType: "string"
          }
        },
        created_at: {
          bsonType: "date"
        }
      }
    }
  }
});

db.operation_templates.createIndex({ "template_name": 1 }, { unique: true });
db.operation_templates.createIndex({ "applicable_to": 1 });

// Collection: operation_history
// Tracks usage and corrections for learning
db.createCollection("operation_history", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["operation_name", "program_type", "action"],
      properties: {
        operation_name: {
          bsonType: "string"
        },
        program_type: {
          bsonType: "string"
        },
        action: {
          enum: ["executed", "corrected", "failed", "deprecated"]
        },
        original: {
          bsonType: "object",
          description: "Original operation if corrected"
        },
        corrected: {
          bsonType: "object",
          description: "Corrected version if applicable"
        },
        reason: {
          bsonType: "string",
          description: "Reason for correction or failure"
        },
        context: {
          bsonType: "object",
          description: "Context when this action occurred"
        },
        timestamp: {
          bsonType: "date"
        }
      }
    }
  }
});

db.operation_history.createIndex({ "operation_name": 1, "program_type": 1 });
db.operation_history.createIndex({ "action": 1 });
db.operation_history.createIndex({ "timestamp": -1 });

// Sample document for operations collection
var sampleOperation = {
  "name": "CreateUSPersonAccountHolder",
  "program_type": "consumer_credit",
  "operation_type": "mutation",
  "graphql": {
    "query": `mutation CreateUSPersonAccountHolder($input: CreateUSPersonAccountHolderInput!) {
      createUSPersonAccountHolder(input: $input) {
        __typename
        ... on USPersonAccountHolder {
          id
          email
          externalId
          profile {
            application {
              id
              status
            }
          }
        }
        ... on UserError {
          errors {
            path
            code
            description
          }
        }
      }
    }`,
    "variables": {
      "input": {
        "email": "{{email}}",
        "dateOfBirth": "{{dateOfBirth}}",
        "name": {
          "givenName": "{{givenName}}",
          "familyName": "{{familyName}}",
          "middleName": "{{middleName}}"
        },
        "billingAddress": {
          "streetAddress": "{{streetAddress}}",
          "locality": "{{city}}",
          "postalCode": "{{postalCode}}",
          "region": "{{state}}",
          "countryCodeAlpha3": "USA"
        },
        "phoneNumbers": [
          {
            "countryCode": "1",
            "number": "{{phoneNumber}}",
            "label": "MOBILE"
          }
        ],
        "identificationDocument": {
          "socialSecurityNumber": "{{ssn}}"
        },
        "personCreditRiskAttributes": {
          "totalAnnualIncome": "{{annualIncome}}",
          "currentDebtObligations": "{{debtObligations}}",
          "employmentStatus": "{{employmentStatus}}",
          "monthlyHousingPayment": "{{housingPayment}}"
        },
        "externalId": "{{externalId}}"
      }
    }
  },
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{token}}"
  },
  "metadata": {
    "category": "onboarding",
    "description": "Create a new US person account holder with KYC and credit risk information",
    "requires": ["email", "dateOfBirth", "ssn", "annualIncome"],
    "produces": ["accountHolderId", "applicationId"],
    "tags": ["account_holder", "kyc", "credit_application"]
  },
  "version": "1.0.0",
  "created_at": new Date(),
  "updated_at": new Date()
};
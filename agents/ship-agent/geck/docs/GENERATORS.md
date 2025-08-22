# GECK Document Generators

## Overview

The GECK Document Generators system provides a comprehensive platform for generating various types of documentation, diagrams, and exports for API programs. The system is designed to be extensible, allowing easy addition of new generator types.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                 │     │                  │     │                  │
│   React UI      │────▶│ Netlify Function │────▶│ Python Service   │
│   (TypeScript)  │     │   (TypeScript)   │     │    (FastAPI)     │
│                 │     │                  │     │                  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
   [Generator UI]          [Auth & API]            [Document Gen]
```

## Available Generators

### 1. Solution Document Generator
- **Purpose**: Generate comprehensive solution documents for API programs
- **Inputs**: Program configuration, optional customer context
- **Outputs**: Markdown, PDF, HTML, Confluence, DOCX
- **Sections**:
  - Executive Summary
  - Technical Overview
  - Use Cases
  - Workflows
  - API Reference
  - Integration Guide
  - Security & Compliance
  - Appendices

### 2. Workflow Diagram Generator
- **Purpose**: Create sequence diagrams for business workflows
- **Inputs**: Program workflows, optional aliases
- **Outputs**: Mermaid diagrams in Markdown/HTML/PDF
- **Features**:
  - Alias support for participant names
  - Customizable color schemes
  - Timestamp options

### 3. ERD Diagram Generator (Planned)
- **Purpose**: Generate entity relationship diagrams
- **Inputs**: Data models from program configuration
- **Outputs**: Mermaid ERD diagrams
- **Features**:
  - Relationship visualization
  - Index indicators
  - Horizontal/vertical layouts

## Getting Started

### Prerequisites

1. **Node.js & npm** - For running the React application
2. **Python 3.8+** - For running the generator service
3. **MongoDB** - For storing generation history

### Installation

```bash
# Install Node dependencies
cd agents/ship-agent/geck
npm install

# Install Python dependencies
pip install fastapi uvicorn pydantic pyyaml jinja2
```

### Running the System

#### Development Mode (All Services)

```bash
cd agents/ship-agent/geck
npm run start:all
```

This starts:
- React app on http://localhost:3000
- Netlify Functions on http://localhost:9000
- Generator Service on http://localhost:8001

#### Individual Services

```bash
# React app only
npm run start:app

# Netlify Functions only
npm run start:functions

# Generator Service only
npm run start:generator
```

## Usage Guide

### Generating a Solution Document

1. **Navigate to Generators**
   - Go to `/solution` in the GECK application
   - You'll see a grid of available generators

2. **Select Solution Document**
   - Click on the Solution Document card
   - View recent generation history if available

3. **Configure Generation**
   - **Select Program**: Choose from existing programs
   - **Select Context** (Optional): Choose customer context for personalization
   - **Choose Sections**: Toggle which sections to include
   - **Select Export Formats**: Choose output formats (MD, PDF, HTML, etc.)

4. **Generate & Preview**
   - Click "Generate Solution Document"
   - Preview the generated content
   - Toggle between Preview and Source views

5. **Export**
   - Click export button for desired format
   - Download the generated document

### Creating Custom Generators

To add a new generator type:

1. **Update TypeScript Types** (`src/lib/generators/types.ts`):
```typescript
export type GeneratorType = 
  | 'solution'
  | 'workflow'
  | 'your-new-type'; // Add here

// Add to GENERATOR_CATALOG
'your-new-type': {
  id: 'your-new-type',
  name: 'Your Generator',
  description: 'Description',
  icon: '🎯',
  category: 'documents',
  requiredFields: ['programId'],
  optionalFields: [],
  exportFormats: ['markdown', 'pdf'],
}
```

2. **Implement Python Generator** (`src/generator_service.py`):
```python
async def generate_your_type(request: GenerateRequest) -> GenerateResponse:
    # Your generation logic here
    content = generate_content(request)
    return GenerateResponse(
        title="Generated Document",
        content=content,
        sections=parse_sections(content),
        exports=create_exports(content)
    )
```

3. **Update Generator Service Router**:
```python
if request.type == "your-new-type":
    return await generate_your_type(request)
```

## API Reference

### Generator Endpoints

#### Generate Document
```
POST /generators
{
  "type": "solution",
  "config": {
    "programId": "...",
    "contextId": "...",
    "options": {...},
    "exportFormats": ["markdown", "pdf"]
  }
}
```

#### Get Generation Status
```
GET /generators/:id
```

#### Get Generation History
```
GET /generators/history?type=solution&limit=10
```

#### Export Document
```
POST /generators/:id/export
{
  "format": "pdf"
}
```

## Configuration

### Environment Variables

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=geck

# Generator Service
GENERATOR_SERVICE_URL=http://localhost:8001
GENERATOR_SERVICE_PORT=8001

# JWT Secret (for auth)
JWT_SECRET=your-secret-key
```

### Generator Options

Each generator supports specific options:

#### Solution Document Options
```typescript
{
  solutionSections: {
    executiveSummary: boolean,
    technicalOverview: boolean,
    useCases: boolean,
    workflows: boolean,
    apiReference: boolean,
    integrationGuide: boolean,
    securityCompliance: boolean,
    appendices: boolean
  }
}
```

#### Workflow Diagram Options
```typescript
{
  workflowOptions: {
    includeAliases: boolean,
    showTimestamps: boolean,
    colorScheme: 'default' | 'monochrome' | 'high-contrast'
  }
}
```

## Troubleshooting

### Common Issues

1. **Generator Service Not Starting**
   - Check Python is installed: `python3 --version`
   - Install dependencies: `pip install -r requirements.txt`
   - Check port 8001 is available

2. **Generation Fails**
   - Check MongoDB connection
   - Verify program/context IDs exist
   - Check generator service logs

3. **Export Not Working**
   - Ensure export formats are supported
   - Check file permissions in export directory
   - Verify export formatter dependencies

### Debug Mode

Enable debug logging:
```bash
export DEBUG=true
npm run start:all
```

View generator service logs:
```bash
tail -f logs/generator-service.log
```

## Performance Considerations

- **Caching**: Generated documents are cached for 15 minutes
- **Streaming**: Large documents are streamed to prevent timeouts
- **Background Jobs**: Long-running generations can be queued
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse

## Security

- **Authentication**: All generator endpoints require JWT authentication
- **Authorization**: Users can only access their own generation history
- **Input Validation**: All inputs are validated and sanitized
- **Export Security**: Generated URLs expire after 1 hour

## Future Enhancements

1. **Template Customization**
   - User-defined templates
   - Template marketplace
   - Version control for templates

2. **Batch Generation**
   - Generate multiple documents at once
   - Scheduled generation
   - Bulk export

3. **Collaboration Features**
   - Share generated documents
   - Collaborative editing
   - Review workflows

4. **Advanced Generators**
   - API test suite generator
   - SDK generator
   - OpenAPI spec generator
   - Postman collection generator

## Contributing

To contribute a new generator:

1. Fork the repository
2. Create a feature branch
3. Implement the generator following the patterns above
4. Add tests for your generator
5. Update this documentation
6. Submit a pull request

## Support

For issues or questions:
- Check the [troubleshooting guide](#troubleshooting)
- Review existing [GitHub issues](https://github.com/your-repo/issues)
- Contact the development team
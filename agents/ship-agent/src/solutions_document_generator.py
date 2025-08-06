#!/usr/bin/env python3
"""
Solutions Document Generator
Generates comprehensive solutions documentation from Postman collections
Refactored to follow SOLID principles with configurable sections
"""
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Protocol
from datetime import datetime
import argparse
import re
from collections import defaultdict
from abc import ABC, abstractmethod


class SectionGenerator(ABC):
    """Abstract base class for document section generators"""
    
    @abstractmethod
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        """Generate the section content"""
        pass
    
    @abstractmethod
    def get_section_id(self) -> str:
        """Return unique identifier for this section"""
        pass
    
    @abstractmethod
    def get_section_name(self) -> str:
        """Return human-readable name for this section"""
        pass


class HeaderSection(SectionGenerator):
    """Generates document header section"""
    
    def get_section_id(self) -> str:
        return "header"
    
    def get_section_name(self) -> str:
        return "Document Header"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        customer_part = f" for {customer_name}" if customer_name else ""
        title = f"{program_type.replace('_', ' ').title()} Solution{customer_part}"
        
        return f"""# {title}

**Document Version:** 1.0  
**Generated:** {datetime.now().strftime('%Y-%m-%d')}  
**Collection:** {collection_name}  
**Program Type:** {program_type.replace('_', ' ').title()}"""


class ExecutiveSummarySection(SectionGenerator):
    """Generates executive summary section"""
    
    def get_section_id(self) -> str:
        return "executive_summary"
    
    def get_section_name(self) -> str:
        return "Executive Summary"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        total_ops = analysis['total_operations']
        categories = len(analysis['categories'])
        
        # Program-specific descriptions
        program_descriptions = {
            'consumer_credit': "consumer credit card issuance and management",
            'commercial_credit': "business credit card programs",
            'consumer_prepaid': "consumer prepaid card solutions",
            'commercial_prepaid': "business prepaid and expense management cards",
            'ap_automation': "accounts payable automation and virtual card payments",
            'fleet': "fleet card management and fuel programs",
            'acquiring': "merchant acquiring and payment processing",
            'travel_services': "travel and expense management solutions"
        }
        
        description = program_descriptions.get(program_type, "financial services")
        
        return f"""## Executive Summary

This document provides a comprehensive technical solution for implementing {description} using the Highnote platform. The solution encompasses {total_ops} API operations organized across {categories} functional categories, enabling end-to-end program management from customer onboarding through transaction processing and reporting.

### Key Capabilities

- **Account Management**: Create and manage account holders with KYC/KYB verification
- **Card Issuance**: Issue physical and virtual payment cards with lifecycle management
- **Transaction Processing**: Real-time authorization and settlement processing
- **Risk Management**: Configurable spend controls and authorization rules
- **Reporting**: Comprehensive reporting and data analytics

### Solution Benefits

1. **Rapid Implementation**: Pre-built API operations accelerate time to market
2. **Flexible Configuration**: Adapt to specific business requirements
3. **Scalable Architecture**: Support growth from pilot to enterprise scale
4. **Regulatory Compliance**: Built-in compliance with financial regulations"""


class TableOfContentsSection(SectionGenerator):
    """Generates table of contents section"""
    
    def __init__(self, enabled_sections: List[str]):
        self.enabled_sections = enabled_sections
    
    def get_section_id(self) -> str:
        return "table_of_contents"
    
    def get_section_name(self) -> str:
        return "Table of Contents"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        # Map section IDs to TOC entries
        toc_entries = {
            'technical_overview': "1. [Technical Overview](#technical-overview)",
            'use_cases': "2. [Use Cases](#use-cases)",
            'implementation_flows': "3. [Implementation Flows](#implementation-flows)",
            'api_reference': "4. [API Operations Reference](#api-operations-reference)",
            'integration_guide': "5. [Integration Guide](#integration-guide)",
            'security_compliance': "6. [Security and Compliance](#security-and-compliance)",
            'appendices': "7. [Appendices](#appendices)"
        }
        
        content = "## Table of Contents\n\n"
        entry_num = 1
        
        for section_id in self.enabled_sections:
            if section_id in toc_entries and section_id not in ['header', 'executive_summary', 'table_of_contents']:
                # Renumber entries based on what's actually included
                entry = toc_entries[section_id]
                entry = re.sub(r'^\d+\.', f'{entry_num}.', entry)
                content += entry + "\n"
                entry_num += 1
        
        return content


class TechnicalOverviewSection(SectionGenerator):
    """Generates technical overview section"""
    
    def get_section_id(self) -> str:
        return "technical_overview"
    
    def get_section_name(self) -> str:
        return "Technical Overview"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        entities = analysis['entities'][:10]  # Top 10 entities
        actions = analysis['actions'][:10]   # Top 10 actions
        
        content = """## Technical Overview

### Architecture

The solution is built on a modern GraphQL API architecture that provides:

- **Single Endpoint**: All operations through a unified GraphQL endpoint
- **Strong Typing**: Type-safe operations with comprehensive schema
- **Efficient Queries**: Request only the data needed
- **Real-time Updates**: Webhook notifications for asynchronous events

### Core Entities

The solution manages the following primary entities:

"""
        
        for entity in entities:
            content += f"- **{entity}**: Core entity for {entity.lower()} management\n"
        
        content += "\n### Supported Operations\n\n"
        content += "The API supports the following operation types:\n\n"
        
        for action in actions:
            content += f"- **{action}**: {self._describe_action(action)}\n"
        
        content += f"\n### API Statistics\n\n"
        content += f"- Total Operations: {analysis['total_operations']}\n"
        content += f"- Categories: {len(analysis['categories'])}\n"
        content += f"- Entity Types: {len(analysis['entities'])}\n"
        content += f"- Operation Types: {len(analysis['actions'])}\n"
        
        return content
    
    def _describe_action(self, action: str) -> str:
        """Generate description for an action"""
        descriptions = {
            'Create': 'Create new entities in the system',
            'Get': 'Retrieve entity details and information',
            'Update': 'Modify existing entity attributes',
            'Delete': 'Remove entities from the system',
            'Issue': 'Issue new cards or accounts',
            'Activate': 'Activate cards or features',
            'Suspend': 'Temporarily disable functionality',
            'Approve': 'Approve applications or transactions',
            'Deny': 'Deny applications or transactions',
            'Simulate': 'Test scenarios in sandbox environment'
        }
        return descriptions.get(action, f"{action} operations")


class UseCasesSection(SectionGenerator):
    """Generates use cases section"""
    
    def get_section_id(self) -> str:
        return "use_cases"
    
    def get_section_name(self) -> str:
        return "Use Cases"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        content = """## Use Cases

### Primary Use Cases

"""
        
        # Program-specific use cases
        if 'credit' in program_type:
            content += """#### Consumer Credit Card Issuance
- Digital application and instant decisioning
- Risk-based pricing and credit limit assignment
- Rewards program integration
- Mobile wallet provisioning

#### Credit Line Management
- Dynamic credit limit adjustments
- Utilization monitoring
- Payment processing and statement generation
- Delinquency management

"""
        elif 'prepaid' in program_type:
            content += """#### Prepaid Card Programs
- Gift card issuance and activation
- Payroll card distribution
- Expense management cards
- Travel cards with multi-currency support

#### Fund Management
- Real-time balance updates
- Multiple funding sources
- Transfer capabilities
- Balance protection

"""
        elif 'ap_automation' in program_type:
            content += """#### Accounts Payable Automation
- Virtual card generation for vendor payments
- Invoice matching and reconciliation
- Approval workflow integration
- Spend analytics and reporting

#### Vendor Management
- Vendor onboarding and verification
- Payment method configuration
- Transaction categorization

"""
        elif 'travel' in program_type:
            content += """#### Travel Expense Management
- Virtual card issuance for travel bookings
- Real-time expense tracking
- Multi-currency transactions
- Integration with travel platforms

#### Policy Enforcement
- Travel policy compliance
- Automated expense categorization
- Receipt capture and matching

"""
        
        content += """### Secondary Use Cases

- Fraud detection and prevention
- Dispute management and chargeback handling
- Regulatory reporting and compliance
- Customer service and support tools"""
        
        return content


class ImplementationFlowsSection(SectionGenerator):
    """Generates implementation flows section"""
    
    def get_section_id(self) -> str:
        return "implementation_flows"
    
    def get_section_name(self) -> str:
        return "Implementation Flows"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        content = """## Implementation Flows

### Core Implementation Workflows

"""
        
        # Add identified flows
        for flow in analysis['flows']:
            content += f"#### {flow['name']}\n\n"
            content += "Sequential operations:\n\n"
            for i, op in enumerate(flow['operations'], 1):
                content += f"{i}. {op}\n"
            content += "\n"
        
        # Add standard flows if not already included
        content += """### Standard Integration Patterns

#### Synchronous Operations
- Request/Response pattern for immediate results
- Used for: Account creation, card issuance, data retrieval
- Response time: < 500ms typical

#### Asynchronous Operations
- Webhook notifications for long-running processes
- Collaborative Authorization for card transactions
- Used for: KYC verification, physical card production, batch processing
- Webhook delivery: Real-time with retry logic

#### Batch Processing
- Scheduled operations for bulk updates
- Used for: Statement generation, reporting, maintenance
- Processing windows: Configurable off-peak scheduling"""
        
        return content


class APIReferenceSection(SectionGenerator):
    """Generates API reference section"""
    
    def get_section_id(self) -> str:
        return "api_reference"
    
    def get_section_name(self) -> str:
        return "API Operations Reference"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        content = """## API Operations Reference

### Operations by Category

"""
        
        # Group operations by category
        for category, operations in sorted(analysis['categories'].items()):
            content += f"#### {category}\n\n"
            content += f"Total operations: {len(operations)}\n\n"
            
            # Table format
            content += "| Operation | Type | Description |\n"
            content += "|-----------|------|-------------|\n"
            
            for op in operations[:10]:  # Show first 10
                op_type = op['type'].title() if op['type'] != 'unknown' else 'API'
                desc = self._generate_operation_description(op['name'])
                content += f"| {op['name']} | {op_type} | {desc} |\n"
            
            if len(operations) > 10:
                content += f"\n*... and {len(operations) - 10} more operations*\n"
            
            content += "\n"
        
        return content
    
    def _generate_operation_description(self, op_name: str) -> str:
        """Generate description for an operation based on its name"""
        # Extract key parts
        parts = re.findall(r'[A-Z][a-z]+', op_name)
        
        if not parts:
            return "Perform operation"
        
        action = parts[0].lower()
        entity = ' '.join(parts[1:]).lower() if len(parts) > 1 else 'entity'
        
        # Generate description
        if action == 'create':
            return f"Create a new {entity}"
        elif action == 'get':
            return f"Retrieve {entity} details"
        elif action == 'update':
            return f"Update {entity} information"
        elif action == 'delete':
            return f"Delete {entity}"
        elif action == 'issue':
            return f"Issue new {entity}"
        elif action == 'activate':
            return f"Activate {entity}"
        elif action == 'suspend':
            return f"Suspend {entity}"
        else:
            return f"{action.capitalize()} {entity}"


class IntegrationGuideSection(SectionGenerator):
    """Generates integration guide section"""
    
    def get_section_id(self) -> str:
        return "integration_guide"
    
    def get_section_name(self) -> str:
        return "Integration Guide"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        return """## Integration Guide

### Prerequisites

1. **API Credentials**
   - Organization ID
   - API Key with appropriate permissions
   - Webhook endpoint (for asynchronous events)

2. **Environment Setup**
   - Sandbox environment for testing
   - Production environment credentials
   - IP whitelisting (if required)

### Quick Start Integration

#### Step 1: Authentication

```http
POST https://api.us.test.highnoteplatform.com/graphql
Authorization: Basic BASE64_ENCODED_YOUR_API_KEY
Content-Type: application/json
```

#### Step 2: Test Connection

```graphql
query Ping {
  ping
}
```

#### Step 3: Create First Entity

Example for creating an account holder:

```graphql
mutation CreateAccountHolder($input: CreateAccountHolderInput!) {
  createAccountHolder(input: $input) {
    id
    status
  }
}
```

### Integration Best Practices

1. **Error Handling**
   - Implement exponential backoff for retries
   - Log all error responses for debugging
   - Handle specific error codes appropriately

2. **Idempotency**
   - Use idempotency keys for mutation operations
   - Store transaction references for reconciliation

3. **Rate Limiting**
   - Respect API rate limits
   - Implement request queuing for bulk operations

4. **Data Synchronization**
   - Use webhooks for real-time updates
   - Implement periodic reconciliation
   - Cache frequently accessed data

### Testing Strategy

1. **Sandbox Testing**
   - Complete end-to-end flows in sandbox
   - Test error scenarios and edge cases
   - Validate webhook handling

2. **Load Testing**
   - Simulate production volumes
   - Test concurrent operations
   - Monitor response times

3. **Security Testing**
   - Validate authentication mechanisms
   - Test data encryption
   - Verify PCI compliance"""


class SecurityComplianceSection(SectionGenerator):
    """Generates security and compliance section"""
    
    def get_section_id(self) -> str:
        return "security_compliance"
    
    def get_section_name(self) -> str:
        return "Security and Compliance"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        content = """## Security and Compliance

### Security Architecture

#### Data Protection
- **Encryption**: TLS 1.2+ for data in transit
- **Storage**: AES-256 encryption for data at rest
- **Tokenization**: Sensitive data tokenization
- **Access Control**: Role-based permissions

#### Authentication Methods
"""
        
        # List detected auth methods
        for auth_method in analysis['auth_methods']:
            content += f"- {auth_method.upper()} authentication supported\n"
        
        content += """
### Compliance Standards

#### PCI DSS Compliance
- Level 1 PCI DSS certification
- Annual security assessments
- Quarterly vulnerability scans
- Secure card data handling

#### Regulatory Compliance
- **USA PATRIOT Act**: KYC/AML procedures
- **OFAC**: Sanctions screening
- **Reg E**: Electronic funds transfer protections
- **GDPR**: Data privacy for EU residents

### Security Best Practices

1. **API Key Management**
   - Rotate keys regularly
   - Use separate keys for environments
   - Implement key encryption
   - Monitor key usage

2. **Data Handling**
   - Never log sensitive data
   - Implement field-level encryption
   - Use secure communication channels
   - Follow data retention policies

3. **Monitoring and Alerting**
   - Real-time fraud monitoring
   - Anomaly detection
   - Security event logging
   - Incident response procedures"""
        
        return content


class AppendicesSection(SectionGenerator):
    """Generates appendices section"""
    
    def get_section_id(self) -> str:
        return "appendices"
    
    def get_section_name(self) -> str:
        return "Appendices"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        return f"""## Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| GraphQL | Query language for APIs |
| Mutation | Operation that modifies data |
| Query | Operation that retrieves data |
| Webhook | HTTP callback for events |
| KYC | Know Your Customer verification |
| PCI DSS | Payment Card Industry Data Security Standard |

### Appendix B: Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| INVALID_INPUT | Request validation failed | Check input parameters |
| UNAUTHORIZED | Authentication failed | Verify API credentials |
| RATE_LIMITED | Too many requests | Implement backoff strategy |
| INTERNAL_ERROR | Server error | Contact support |

### Appendix C: Resources

- **API Documentation**: https://docs.highnote.com
- **Developer Portal**: https://dashboard.highnote.com
- **Support**: support@highnote.com
- **Status Page**: https://status.highnote.com

### Appendix D: Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | {datetime.now().strftime('%Y-%m-%d')} | Initial document generation |

---

*This document was automatically generated from Postman collection analysis.*"""


class CollectionAnalyzer:
    """Analyzes Postman collections to extract patterns and metadata"""
    
    def analyze(self, collection: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze Postman collection structure and contents"""
        analysis = {
            'info': collection.get('info', {}),
            'categories': defaultdict(list),
            'operations': [],
            'entities': set(),
            'actions': set(),
            'flows': [],
            'auth_methods': set(),
            'variables': collection.get('variable', []),
            'total_operations': 0
        }
        
        # Process items (folders and requests)
        items = collection.get('item', [])
        for item in items:
            self._process_item(item, analysis)
        
        # Identify common flows
        analysis['flows'] = self._identify_flows(analysis['operations'])
        
        # Convert sets to lists for JSON serialization
        analysis['entities'] = sorted(list(analysis['entities']))
        analysis['actions'] = sorted(list(analysis['actions']))
        analysis['auth_methods'] = sorted(list(analysis['auth_methods']))
        
        return analysis
    
    def _process_item(self, item: Dict[str, Any], analysis: Dict[str, Any], 
                     parent_category: Optional[str] = None):
        """Process a Postman item (folder or request)"""
        if 'item' in item:
            # It's a folder
            category_name = item.get('name', 'Uncategorized')
            for sub_item in item['item']:
                self._process_item(sub_item, analysis, category_name)
        else:
            # It's a request
            operation = self._extract_operation_details(item)
            if parent_category:
                analysis['categories'][parent_category].append(operation)
            analysis['operations'].append(operation)
            analysis['total_operations'] += 1
            
            # Extract entities and actions
            entities, actions = self._extract_patterns_from_name(operation['name'])
            analysis['entities'].update(entities)
            analysis['actions'].update(actions)
            
            # Extract auth method
            if 'auth' in item:
                analysis['auth_methods'].add(item['auth'].get('type', 'unknown'))
    
    def _extract_operation_details(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Extract operation details from a request"""
        operation = {
            'name': request.get('name', 'Unknown'),
            'description': request.get('description', ''),
            'method': 'POST',  # Default for GraphQL
            'url': '',
            'type': 'unknown',
            'graphql_operation': None,
            'variables': {}
        }
        
        # Extract request details
        req = request.get('request', {})
        operation['method'] = req.get('method', 'POST')
        
        # Extract URL
        url = req.get('url', {})
        if isinstance(url, dict):
            operation['url'] = url.get('raw', '')
        else:
            operation['url'] = str(url)
        
        # Extract GraphQL details
        body = req.get('body', {})
        if body.get('mode') == 'graphql':
            graphql = body.get('graphql', {})
            query = graphql.get('query', '')
            
            # Determine operation type
            if query.strip().startswith('mutation'):
                operation['type'] = 'mutation'
            elif query.strip().startswith('query'):
                operation['type'] = 'query'
            
            # Extract operation name from GraphQL
            match = re.search(r'(mutation|query)\s+(\w+)', query)
            if match:
                operation['graphql_operation'] = match.group(2)
            
            # Extract variables
            variables = graphql.get('variables', '{}')
            try:
                operation['variables'] = json.loads(variables) if isinstance(variables, str) else variables
            except:
                operation['variables'] = {}
        
        return operation
    
    def _extract_patterns_from_name(self, name: str) -> tuple:
        """Extract entity types and actions from operation name"""
        entities = set()
        actions = set()
        
        # Common entities
        entity_patterns = [
            'AccountHolder', 'Account', 'Card', 'Transaction', 'Payment',
            'Application', 'Document', 'Statement', 'Transfer', 'Webhook',
            'Rule', 'Limit', 'Authorization', 'Report', 'Notification'
        ]
        
        # Common actions
        action_patterns = [
            'Create', 'Get', 'Update', 'Delete', 'Issue', 'Activate',
            'Suspend', 'Close', 'Approve', 'Deny', 'Simulate', 'Generate',
            'Attach', 'Detach', 'Search', 'List', 'Process', 'Order'
        ]
        
        for entity in entity_patterns:
            if entity in name:
                entities.add(entity)
        
        for action in action_patterns:
            if name.startswith(action):
                actions.add(action)
        
        return entities, actions
    
    def _identify_flows(self, operations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify common operational flows"""
        flows = []
        
        # Onboarding flow
        onboarding_ops = [op for op in operations if any(
            keyword in op['name'] for keyword in ['Create', 'AccountHolder', 'Application', 'Issue']
        )]
        if len(onboarding_ops) >= 3:
            flows.append({
                'name': 'Customer Onboarding',
                'operations': [op['name'] for op in onboarding_ops[:5]]
            })
        
        # Card management flow
        card_ops = [op for op in operations if 'Card' in op['name']]
        if len(card_ops) >= 3:
            flows.append({
                'name': 'Card Lifecycle Management',
                'operations': [op['name'] for op in card_ops[:5]]
            })
        
        # Transaction flow
        transaction_ops = [op for op in operations if any(
            keyword in op['name'] for keyword in ['Transaction', 'Authorization', 'Clearing']
        )]
        if transaction_ops:
            flows.append({
                'name': 'Transaction Processing',
                'operations': [op['name'] for op in transaction_ops[:5]]
            })
        
        return flows


class SectionRegistry:
    """Registry for document sections"""
    
    def __init__(self):
        self._sections: Dict[str, SectionGenerator] = {}
        self._order: List[str] = []
    
    def register(self, section: SectionGenerator, order: Optional[int] = None):
        """Register a section generator"""
        section_id = section.get_section_id()
        self._sections[section_id] = section
        
        if order is not None:
            self._order.insert(order, section_id)
        else:
            self._order.append(section_id)
    
    def get_section(self, section_id: str) -> Optional[SectionGenerator]:
        """Get a section generator by ID"""
        return self._sections.get(section_id)
    
    def get_all_sections(self) -> List[str]:
        """Get all registered section IDs in order"""
        return self._order.copy()
    
    def get_section_names(self) -> Dict[str, str]:
        """Get mapping of section IDs to names"""
        return {
            section_id: self._sections[section_id].get_section_name()
            for section_id in self._order
        }


class SolutionsDocumentGenerator:
    """
    Generates professional solutions documentation from Postman collections
    Following SOLID principles with configurable sections
    """
    
    def __init__(self, output_dir: str = "data/generated",
                 enabled_sections: Optional[List[str]] = None):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.analyzer = CollectionAnalyzer()
        self.registry = SectionRegistry()
        
        # Register all available sections in order
        self._register_default_sections()
        
        # Set enabled sections
        if enabled_sections is None:
            self.enabled_sections = self.registry.get_all_sections()
        else:
            # Validate enabled sections
            available = set(self.registry.get_all_sections())
            invalid = set(enabled_sections) - available
            if invalid:
                raise ValueError(f"Invalid section IDs: {invalid}. Available: {available}")
            self.enabled_sections = enabled_sections
    
    def _register_default_sections(self):
        """Register default document sections"""
        self.registry.register(HeaderSection(), 0)
        self.registry.register(ExecutiveSummarySection(), 1)
        # TOC needs to know enabled sections, will be created dynamically
        self.registry.register(TechnicalOverviewSection(), 3)
        self.registry.register(UseCasesSection(), 4)
        self.registry.register(ImplementationFlowsSection(), 5)
        self.registry.register(APIReferenceSection(), 6)
        self.registry.register(IntegrationGuideSection(), 7)
        self.registry.register(SecurityComplianceSection(), 8)
        self.registry.register(AppendicesSection(), 9)
    
    def generate_from_postman(self, postman_file: str, 
                            customer_name: Optional[str] = None,
                            program_type: Optional[str] = None,
                            sections: Optional[List[str]] = None) -> str:
        """
        Generate solutions document from Postman collection
        
        Args:
            postman_file: Path to Postman collection JSON
            customer_name: Optional customer name for customization
            program_type: Optional program type override
            sections: Optional list of section IDs to include
            
        Returns:
            Path to generated markdown file
        """
        # Load Postman collection
        with open(postman_file, 'r') as f:
            collection = json.load(f)           
        
        # Extract metadata
        collection_info = collection.get('info', {})
        collection_name = collection_info.get('name', 'Unknown Collection')
        
        # Infer program type if not provided
        if not program_type:
            program_type = self._infer_program_type(collection_name, collection)
        
        # Analyze collection
        analysis = self.analyzer.analyze(collection)
        
        # Use provided sections or default enabled sections
        sections_to_generate = sections if sections is not None else self.enabled_sections
        
        # Generate document sections
        doc_sections = []
        
        for section_id in sections_to_generate:
            if section_id == 'table_of_contents':
                # Special handling for TOC - needs to know which sections are enabled
                toc_section = TableOfContentsSection(sections_to_generate)
                self.registry.register(toc_section, 2)
                content = toc_section.generate(collection_name, customer_name, program_type, analysis)
            else:
                section = self.registry.get_section(section_id)
                if section:
                    content = section.generate(collection_name, customer_name, program_type, analysis)
                    doc_sections.append(content)
        
        # Combine sections
        document = "\n\n".join(doc_sections)
        
        # Create customer-specific directory
        if customer_name:
            customer_dir = self.output_dir / customer_name.lower().replace(' ', '_')
        else:
            customer_dir = self.output_dir / "default"
        customer_dir.mkdir(parents=True, exist_ok=True)
        
        # Save document in customer directory
        filename = f"{program_type}_solution.md"
        output_path = customer_dir / filename
        
        with open(output_path, 'w') as f:
            f.write(document)
        
        print(f"Generated solutions document: {output_path}")
        return str(output_path)
    
    def _infer_program_type(self, collection_name: str, collection: Dict[str, Any]) -> str:
        """Infer program type from collection name and contents"""
        name_lower = collection_name.lower()
        
        # Check common patterns
        if 'credit' in name_lower:
            if 'consumer' in name_lower:
                return 'consumer_credit'
            elif 'commercial' in name_lower or 'business' in name_lower:
                return 'commercial_credit'
            return 'credit'
        elif 'prepaid' in name_lower:
            if 'consumer' in name_lower:
                return 'consumer_prepaid'
            elif 'commercial' in name_lower or 'business' in name_lower:
                return 'commercial_prepaid'
            return 'prepaid'
        elif 'ap' in name_lower or 'automation' in name_lower:
            return 'ap_automation'
        elif 'fleet' in name_lower:
            return 'fleet'
        elif 'acquiring' in name_lower:
            return 'acquiring'
        elif 'travel' in name_lower or 'trip' in name_lower:
            return 'travel_services'
        
        return 'financial_services'
    
    def get_available_sections(self) -> Dict[str, str]:
        """Get all available section IDs and their names"""
        return self.registry.get_section_names()


def main():
    """CLI interface for solutions document generator"""
    parser = argparse.ArgumentParser(
        description='Generate solutions documentation from Postman collections',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate with all sections
  python solutions_document_generator.py collection.json --customer "ABC Bank"
  
  # Generate with specific sections only
  python solutions_document_generator.py collection.json --sections header executive_summary api_reference
  
  # List available sections
  python solutions_document_generator.py --list-sections
        """
    )
    
    parser.add_argument('postman_file', nargs='?', help='Path to Postman collection JSON file')
    parser.add_argument('--customer', help='Customer name for customization')
    parser.add_argument('--program-type', help='Program type (e.g., consumer_credit)')
    parser.add_argument('--output-dir', default='data/generated', 
                       help='Output directory for generated documents')
    parser.add_argument('--sections', nargs='+', 
                       help='Specific sections to include (default: all sections)')
    parser.add_argument('--list-sections', action='store_true',
                       help='List all available section IDs')
    
    args = parser.parse_args()
    
    # Create generator
    generator = SolutionsDocumentGenerator(args.output_dir)
    
    if args.list_sections:
        print("Available document sections:")
        print("-" * 40)
        for section_id, section_name in generator.get_available_sections().items():
            print(f"{section_id:<25} {section_name}")
        return 0
    
    if not args.postman_file:
        parser.print_help()
        return 1
    
    try:
        # Generate document
        output_path = generator.generate_from_postman(
            args.postman_file,
            args.customer,
            args.program_type,
            args.sections
        )
        
        print(f"\nSuccessfully generated solutions document: {output_path}")
        
    except Exception as e:
        print(f"Error generating document: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
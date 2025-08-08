#!/usr/bin/env python3
"""
Modular Solution Generator
A data-driven solution document generator that combines program configs, 
customer contexts, and Postman collections without any hardcoded logic.
"""
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import argparse
from collections import defaultdict
from jinja2 import Environment, FileSystemLoader, select_autoescape
from src.export_formatter import MultiFormatExporter
from src.workflow_diagram_generator import WorkflowDiagramGenerator


class ConfigLoader:
    """Load and validate program configurations"""
    
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
    
    def load(self, program_type: str) -> Dict[str, Any]:
        """Load program configuration from YAML"""
        # Try enhanced version first, fall back to standard
        enhanced_path = self.config_dir / f"{program_type}_enhanced.yaml"
        standard_path = self.config_dir / f"{program_type}.yaml"
        
        config_path = enhanced_path if enhanced_path.exists() else standard_path
        
        if not config_path.exists():
            raise FileNotFoundError(f"No configuration found for program: {program_type}")
        
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Validate required fields
        self._validate_config(config)
        
        return config
    
    def _validate_config(self, config: Dict[str, Any]):
        """Validate configuration structure"""
        required_fields = ['program_type', 'vendor', 'categories']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field in config: {field}")


class ContextLoader:
    """Load and validate customer contexts"""
    
    def __init__(self, context_dir: Path):
        self.context_dir = context_dir
    
    def load(self, customer_name: str) -> Optional[Dict[str, Any]]:
        """Load customer context from JSON"""
        if not customer_name:
            return None
        
        # Try v2 version first, fall back to v1
        v2_path = self.context_dir / f"{customer_name.lower().replace(' ', '_')}_context_v2.json"
        v1_path = self.context_dir / f"{customer_name.lower().replace(' ', '_')}_context.json"
        
        context_path = v2_path if v2_path.exists() else v1_path
        
        if not context_path.exists():
            return None  # Context is optional
        
        with open(context_path, 'r') as f:
            context = json.load(f)
        
        return context


class PostmanAnalyzer:
    """Analyze Postman collections for operations data"""
    
    def __init__(self, postman_dir: Path):
        self.postman_dir = postman_dir
    
    def analyze(self, collection_name: str) -> Dict[str, Any]:
        """Analyze Postman collection and extract operations"""
        collection_path = self.postman_dir / f"{collection_name}.json"
        
        if not collection_path.exists():
            # Return empty analysis if no Postman collection
            return {
                'total_operations': 0,
                'categories': {},
                'operations': []
            }
        
        with open(collection_path, 'r') as f:
            collection = json.load(f)
        
        analysis = {
            'info': collection.get('info', {}),
            'categories': defaultdict(list),
            'operations': [],
            'total_operations': 0
        }
        
        # Process collection items
        items = collection.get('item', [])
        for item in items:
            self._process_item(item, analysis)
        
        analysis['total_operations'] = len(analysis['operations'])
        analysis['categories'] = dict(analysis['categories'])
        
        return analysis
    
    def _process_item(self, item: Dict[str, Any], analysis: Dict[str, Any], 
                     category: Optional[str] = None):
        """Process Postman collection item"""
        if 'item' in item:
            # It's a folder
            category_name = item.get('name', 'Uncategorized')
            for sub_item in item['item']:
                self._process_item(sub_item, analysis, category_name)
        else:
            # It's a request
            operation = {
                'name': item.get('name', 'Unknown'),
                'category': category,
                'method': item.get('request', {}).get('method', 'POST')
            }
            
            if category:
                analysis['categories'][category].append(operation)
            analysis['operations'].append(operation)


class TemplateEngine:
    """Jinja2-based template engine for generating sections"""
    
    def __init__(self, template_dir: Path):
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
    
    def render(self, template_name: str, data: Dict[str, Any]) -> str:
        """Render a template with the provided data"""
        try:
            template = self.env.get_template(template_name)
            return template.render(**data)
        except Exception as e:
            # If template doesn't exist, use fallback rendering
            return self._fallback_render(template_name, data)
    
    def _fallback_render(self, template_name: str, data: Dict[str, Any]) -> str:
        """Fallback rendering when template doesn't exist"""
        section_name = template_name.replace('.j2', '').replace('_', ' ').title()
        return f"## {section_name}\n\n*Section content will be generated from data*"


class ModularSolutionGenerator:
    """
    Modular solution document generator
    Combines program configs, customer contexts, and Postman data
    """
    
    def __init__(self, base_dir: Path = None):
        if base_dir is None:
            base_dir = Path(__file__).parent.parent
        
        self.base_dir = base_dir
        self.config_loader = ConfigLoader(base_dir / "data" / "programs")
        self.context_loader = ContextLoader(base_dir / "data" / "contexts")
        self.postman_analyzer = PostmanAnalyzer(base_dir / "data" / "postman")
        
        # Check if templates directory exists
        template_dir = base_dir / "templates"
        if not template_dir.exists():
            # Use inline templates if template directory doesn't exist
            self.template_engine = None
        else:
            self.template_engine = TemplateEngine(template_dir)
        
        self.output_dir = base_dir / "data" / "generated"
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate(self, program_type: str, customer_name: Optional[str] = None, 
                 export_formats: Optional[List[str]] = None) -> Dict[str, str]:
        """
        Generate solution document
        
        Args:
            program_type: Type of program (e.g., 'ap_automation')
            customer_name: Optional customer name for context
            export_formats: Optional list of formats ['confluence', 'pdf', 'html']
            
        Returns:
            Dictionary with paths to all generated files
        """
        # Load all data sources
        config = self.config_loader.load(program_type)
        context = self.context_loader.load(customer_name)
        postman = self.postman_analyzer.analyze(program_type)
        
        # Combine data
        data = {
            'config': config,
            'context': context,
            'postman': postman,
            'customer_name': customer_name,
            'generation_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        # Generate sections
        sections = []
        
        # Header
        sections.append(self._generate_header(data))
        
        # Executive Summary
        sections.append(self._generate_executive_summary(data))
        
        # Technical Overview
        sections.append(self._generate_technical_overview(data))
        
        # Use Cases
        sections.append(self._generate_use_cases(data))
        
        # Implementation Workflows
        sections.append(self._generate_workflows(data))
        
        # API Operations Reference
        sections.append(self._generate_api_reference(data))
        
        # Integration Guide
        sections.append(self._generate_integration_guide(data))
        
        # Security & Compliance
        sections.append(self._generate_security_compliance(data))
        
        # Appendices
        sections.append(self._generate_appendices(data))
        
        # Combine sections
        document = "\n\n".join(sections)
        
        # Save markdown document
        markdown_path = self._save_document(document, program_type, customer_name)
        
        # Export to additional formats if requested
        if export_formats:
            exporter = MultiFormatExporter(self.output_dir)
            exported_files = exporter.export_document(markdown_path, export_formats)
            return exported_files
        else:
            return {'markdown': markdown_path}
    
    def _generate_header(self, data: Dict[str, Any]) -> str:
        """Generate document header"""
        config = data['config']
        context = data['context']
        
        # Determine title
        if context and 'customer' in context:
            customer_name = context['customer']['name']
            title = f"{config.get('metadata', {}).get('name', 'Solution')} for {customer_name}"
        else:
            title = config.get('metadata', {}).get('name', 'Solution Document')
        
        header = f"""# {title}

**Document Version:** 1.0  
**Generated:** {data['generation_date']}  
**Program Type:** {config['program_type']}  
**Vendor:** {config['vendor']}  
**API Type:** {config.get('api_type', 'GraphQL')}"""
        
        return header
    
    def _generate_executive_summary(self, data: Dict[str, Any]) -> str:
        """Generate executive summary from context and config"""
        config = data['config']
        context = data['context']
        postman = data['postman']
        
        summary = "## Executive Summary\n\n"
        
        # Use customer context if available
        if context and 'business_context' in context:
            business = context['business_context']
            
            # Current state
            if 'current_state' in business:
                summary += f"{business['current_state']['description']}\n\n"
            
            # Objectives
            if 'objectives' in business:
                summary += "### Objectives\n\n"
                for objective in business['objectives'].get('primary', []):
                    summary += f"- {objective}\n"
                summary += "\n"
            
            # Business model
            if 'business_model' in business:
                summary += f"{business['business_model']['description']}\n\n"
        else:
            # Fallback to config description
            desc = config.get('metadata', {}).get('description', 'Financial services solution')
            summary += f"This document provides a comprehensive technical solution for {desc}.\n\n"
        
        # Add technical summary
        total_ops = postman['total_operations'] if postman['total_operations'] > 0 else len(config.get('categories', []))
        num_categories = len(postman['categories']) if postman['categories'] else len(config.get('categories', []))
        
        summary += f"The solution encompasses {total_ops} API operations organized across {num_categories} functional categories.\n\n"
        
        # Capabilities from config
        if 'capabilities' in config:
            summary += "### Key Capabilities\n\n"
            for capability in config['capabilities']:
                cap_name = capability.replace('_', ' ').title()
                summary += f"- **{cap_name}**\n"
        
        return summary
    
    def _generate_technical_overview(self, data: Dict[str, Any]) -> str:
        """Generate technical overview from config"""
        config = data['config']
        
        overview = """## Technical Overview

### Architecture

The solution is built on a modern GraphQL API architecture providing:

- **Single Endpoint**: Unified GraphQL endpoint for all operations
- **Strong Typing**: Type-safe operations with comprehensive schema
- **Efficient Queries**: Request only needed data
- **Real-time Updates**: Webhook notifications for events

"""
        
        # Core Entities
        if 'entities' in config:
            overview += "### Core Entities\n\n"
            for entity in config['entities']:
                if isinstance(entity, dict):
                    overview += f"- **{entity['name']}**: {entity['description']}\n"
                else:
                    overview += f"- **{entity}**: Core entity management\n"
            overview += "\n"
        
        # Capabilities
        if 'capabilities' in config:
            overview += "### Capabilities\n\n"
            for capability in config['capabilities']:
                cap_name = capability.replace('_', ' ').title()
                overview += f"- {cap_name}\n"
            overview += "\n"
        
        # Performance requirements
        if 'performance' in config:
            overview += "### Performance Requirements\n\n"
            perf = config['performance']
            
            # Request rate limits
            if 'request_rate' in perf:
                overview += "#### Rate Limits\n"
                for key, value in perf['request_rate'].items():
                    overview += f"- **{key.replace('_', ' ').title()}**: {value}\n"
                overview += "\n"
            
            # Complexity limits
            if 'complexity' in perf:
                overview += "#### Complexity Limits\n"
                for key, value in perf['complexity'].items():
                    overview += f"- **{key.replace('_', ' ').title()}**: {value}\n"
                overview += "\n"
            
            # API performance
            if 'api' in perf:
                overview += "#### API Performance\n"
                overview += f"- Response Time: < {perf['api'].get('response_time_ms', 500)}ms\n"
                overview += f"- Availability: {perf['api'].get('availability', 99.9)}%\n"
                overview += "\n"
            
            # Transaction performance
            if 'transactions' in perf:
                overview += "#### Transaction Performance\n"
                trans = perf['transactions']
                if 'collaborative_authorization_time_ms' in trans:
                    overview += f"- Collaborative Authorization: < {trans['collaborative_authorization_time_ms']}ms\n"
                elif 'authorization_time_ms' in trans:
                    overview += f"- Authorization Time: < {trans['authorization_time_ms']}ms\n"
        
        return overview
    
    def _generate_use_cases(self, data: Dict[str, Any]) -> str:
        """Generate use cases from context or config"""
        context = data['context']
        config = data['config']
        
        use_cases = "## Use Cases\n\n"
        
        # Use customer context if available
        if context and 'use_cases' in context:
            # Primary use cases
            if 'primary' in context['use_cases']:
                use_cases += "### Primary Use Cases\n\n"
                for uc in context['use_cases']['primary']:
                    use_cases += f"#### {uc['title']}\n\n"
                    use_cases += f"{uc['description']}\n\n"
                    if 'scenarios' in uc:
                        for scenario in uc['scenarios']:
                            use_cases += f"- {scenario}\n"
                    if 'value_proposition' in uc:
                        use_cases += f"\n**Value:** {uc['value_proposition']}\n"
                    use_cases += "\n"
            
            # Secondary use cases
            if 'secondary' in context['use_cases']:
                use_cases += "### Secondary Use Cases\n\n"
                for uc in context['use_cases']['secondary']:
                    use_cases += f"#### {uc['title']}\n\n"
                    use_cases += f"{uc['description']}\n\n"
                    if 'scenarios' in uc:
                        for scenario in uc['scenarios']:
                            use_cases += f"- {scenario}\n"
                    use_cases += "\n"
        else:
            # Generate generic use cases based on program type
            program_type = config['program_type']
            if 'automation' in program_type or 'ap' in program_type:
                use_cases += """### Primary Use Cases

#### Virtual Card Payments
- Single-use virtual cards
- Vendor-specific cards
- Automated payment processing

#### Spend Management
- Real-time spend controls
- Budget enforcement
- Transaction monitoring

### Secondary Use Cases
- Reporting and analytics
- Fraud prevention
- Audit trail maintenance
"""
        
        return use_cases
    
    def _generate_workflows(self, data: Dict[str, Any]) -> str:
        """Generate implementation workflows from config with diagrams"""
        config = data['config']
        program_type = config.get('program_type', 'unknown')
        
        workflows_text = "## Implementation Workflows\n\n"
        
        if 'workflows' in config:
            # Generate or use existing sequence diagrams for workflows
            diagrams = {}
            try:
                diagram_gen = WorkflowDiagramGenerator(self.base_dir)
                
                # Get customer and vendor names from data
                customer_name = data.get('customer_name')
                if not customer_name and data.get('context'):
                    customer_name = data['context'].get('customer', {}).get('name')
                
                vendor_name = "Highnote"  # Default vendor
                if data.get('context') and data['context'].get('vendor'):
                    vendor_name = data['context']['vendor'].get('name', vendor_name)
                
                # Check if instantiated diagrams exist for this customer
                customer_dir = customer_name.lower().replace(' ', '_').replace('.', '') if customer_name else None
                instantiated_dir = self.base_dir / "data" / "sequences" / program_type / customer_dir if customer_dir else None
                
                if instantiated_dir and instantiated_dir.exists():
                    # Use existing instantiated diagrams
                    for workflow_id in config['workflows'].keys():
                        diagram_file = instantiated_dir / f"{workflow_id}.md"
                        if diagram_file.exists():
                            diagrams[workflow_id] = str(diagram_file)
                else:
                    # Generate new instantiated diagrams from templates
                    if customer_name and vendor_name:
                        additional_replacements = {}
                        if data.get('context') and data['context'].get('webhook_service'):
                            additional_replacements['WEBHOOK_SERVICE'] = data['context']['webhook_service']
                        
                        diagrams = diagram_gen.batch_instantiate(
                            program_type, customer_name, vendor_name, additional_replacements
                        )
            except Exception as e:
                diagrams = {}
                print(f"Note: Could not generate/load diagrams: {e}")
            
            for workflow_id, workflow in config['workflows'].items():
                workflows_text += f"### {workflow['name']}\n\n"
                if 'description' in workflow:
                    workflows_text += f"{workflow['description']}\n\n"
                
                # Add Mermaid diagram if available
                if workflow_id in diagrams:
                    # Read the diagram content
                    diagram_path = Path(diagrams[workflow_id])
                    if diagram_path.exists():
                        with open(diagram_path, 'r') as f:
                            diagram_content = f.read()
                        # Extract just the mermaid code block
                        import re
                        mermaid_match = re.search(r'```mermaid\n(.*?)\n```', diagram_content, re.DOTALL)
                        if mermaid_match:
                            workflows_text += "```mermaid\n"
                            workflows_text += mermaid_match.group(1)
                            workflows_text += "\n```\n\n"
                
                workflows_text += "**Steps:**\n\n"
                for i, step in enumerate(workflow['steps'], 1):
                    operation = step['operation']
                    required = "Required" if step.get('required', True) else "Optional"
                    workflows_text += f"{i}. **{operation}** ({required})\n"
                    if 'description' in step:
                        workflows_text += f"   - {step['description']}\n"
                    if 'condition' in step:
                        workflows_text += f"   - Condition: {step['condition']}\n"
                workflows_text += "\n"
        
        return workflows_text
    
    def _generate_api_reference(self, data: Dict[str, Any]) -> str:
        """Generate API operations reference"""
        config = data['config']
        postman = data['postman']
        
        api_ref = "## API Operations Reference\n\n"
        
        # Use Postman data if available, otherwise use config
        if postman['categories']:
            api_ref += "### Operations by Category\n\n"
            for category, operations in postman['categories'].items():
                api_ref += f"#### {category}\n\n"
                api_ref += f"Total operations: {len(operations)}\n\n"
                api_ref += "| Operation | Method | Description |\n"
                api_ref += "|-----------|--------|-------------|\n"
                for op in operations:
                    api_ref += f"| {op['name']} | {op.get('method', 'POST')} | Operation |\n"
                api_ref += "\n"
        elif 'categories' in config:
            api_ref += "### Operations by Category\n\n"
            for category in config['categories']:
                api_ref += f"#### {category.get('display_name', category['name'])}\n\n"
                if 'description' in category:
                    api_ref += f"{category['description']}\n\n"
                
                operations = category.get('operations', [])
                if operations:
                    api_ref += f"Total operations: {len(operations)}\n\n"
                    api_ref += "| Operation | Type | Required | Description |\n"
                    api_ref += "|-----------|------|----------|-------------|\n"
                    for op in operations:
                        if isinstance(op, dict):
                            name = op.get('name', 'Unknown')
                            op_type = op.get('type', 'API').title()
                            required = "Yes" if op.get('required', False) else "No"
                            desc = op.get('description', 'Operation')
                            api_ref += f"| {name} | {op_type} | {required} | {desc} |\n"
                        else:
                            api_ref += f"| {op} | API | - | Operation |\n"
                    api_ref += "\n"
        
        return api_ref
    
    def _generate_integration_guide(self, data: Dict[str, Any]) -> str:
        """Generate integration guide"""
        config = data['config']
        
        guide = """## Integration Guide

### Prerequisites

1. **API Credentials**
   - Organization ID
   - API Key with appropriate permissions
   - Webhook endpoint for async events

2. **Environment Setup**
   - Sandbox environment for testing
   - Production environment credentials

### Authentication

"""
        
        # Add authentication details from config
        if 'metadata' in config and 'authentication' in config['metadata']:
            auth = config['metadata']['authentication']
            guide += f"- **Type**: {auth.get('type', 'API Key').upper()}\n"
            guide += f"- **Header**: {auth.get('header', 'Authorization')}\n\n"
        
        guide += """### Quick Start

1. Obtain API credentials
2. Configure webhook endpoints
3. Test connectivity with ping operation
4. Implement core workflows
5. Perform end-to-end testing

### Best Practices

- Implement exponential backoff for retries
- Use idempotency keys for mutations
- Monitor rate limits
- Implement proper error handling
- Use webhook events for async operations
"""
        
        return guide
    
    def _generate_security_compliance(self, data: Dict[str, Any]) -> str:
        """Generate security and compliance section"""
        config = data['config']
        
        security = "## Security and Compliance\n\n"
        
        if 'compliance' in config:
            comp = config['compliance']
            
            # Standards
            if 'standards' in comp:
                security += "### Compliance Standards\n\n"
                for standard in comp['standards']:
                    if isinstance(standard, dict):
                        security += f"- **{standard['name']}**"
                        if 'level' in standard:
                            security += f" Level {standard['level']}"
                        security += "\n"
                    else:
                        security += f"- {standard}\n"
                security += "\n"
            
            # Regulations
            if 'regulations' in comp:
                security += "### Regulatory Compliance\n\n"
                for reg in comp['regulations']:
                    if isinstance(reg, dict):
                        security += f"- **{reg['name']}**: {reg.get('description', '')}\n"
                    else:
                        security += f"- {reg}\n"
                security += "\n"
            
            # Security
            if 'security' in comp:
                sec = comp['security']
                security += "### Security Architecture\n\n"
                
                if 'encryption' in sec:
                    security += "#### Data Encryption\n"
                    security += f"- **In Transit**: {sec['encryption'].get('in_transit', 'TLS 1.2+')}\n"
                    security += f"- **At Rest**: {sec['encryption'].get('at_rest', 'AES-256')}\n\n"
                
                if 'authentication' in sec:
                    security += "#### Authentication\n"
                    for auth in sec['authentication']:
                        if isinstance(auth, dict):
                            security += f"- {auth.get('type', 'Unknown').upper()}"
                            if 'rotation_days' in auth:
                                security += f" (rotate every {auth['rotation_days']} days)"
                            security += "\n"
                    security += "\n"
        else:
            # Default security section
            security += """### Security Standards

- PCI DSS Level 1 Compliance
- SOC 2 Type II Certification
- TLS 1.2+ Encryption
- AES-256 Data Encryption at Rest

### Authentication

- API Key Authentication
- Bearer Token Support
- Key Rotation Policy
"""
        
        return security
    
    def _generate_appendices(self, data: Dict[str, Any]) -> str:
        """Generate appendices"""
        context = data['context']
        
        appendices = "## Appendices\n\n"
        
        # Success Metrics
        if context and 'success_metrics' in context:
            appendices += "### Appendix A: Success Metrics\n\n"
            
            if 'kpis' in context['success_metrics']:
                appendices += "#### Key Performance Indicators\n\n"
                appendices += "| Metric | Target | Timeline |\n"
                appendices += "|--------|--------|----------|\n"
                for kpi in context['success_metrics']['kpis']:
                    appendices += f"| {kpi['metric']} | {kpi['target']} | {kpi['timeline']} |\n"
                appendices += "\n"
            
            if 'milestones' in context['success_metrics']:
                appendices += "#### Implementation Milestones\n\n"
                for milestone in context['success_metrics']['milestones']:
                    appendices += f"**{milestone['phase']}** ({milestone['timeline']})\n"
                    appendices += f"- {milestone['description']}\n"
                    appendices += f"- Success Criteria: {milestone['success_criteria']}\n\n"
        
        # Glossary
        appendices += """### Appendix B: Glossary

| Term | Definition |
|------|------------|
| GraphQL | Query language for APIs |
| Mutation | Operation that modifies data |
| Query | Operation that retrieves data |
| Webhook | HTTP callback for events |
| API Key | Authentication credential |

### Appendix C: Resources

- API Documentation
- Developer Portal
- Support Channels
- Status Page

"""
        
        appendices += f"---\n\n*Generated on {data['generation_date']} from configuration and context data.*"
        
        return appendices
    
    def _save_document(self, document: str, program_type: str, 
                      customer_name: Optional[str]) -> str:
        """Save generated document"""
        # Create output directory structure
        if customer_name:
            customer_dir = self.output_dir / customer_name.lower().replace(' ', '_')
        else:
            customer_dir = self.output_dir / "generic"
        
        customer_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{program_type}_solution_{timestamp}.md"
        
        # Save document
        output_path = customer_dir / filename
        with open(output_path, 'w') as f:
            f.write(document)
        
        print(f"Generated solution document: {output_path}")
        return str(output_path)


def main():
    """CLI interface for modular solution generator"""
    parser = argparse.ArgumentParser(
        description='Generate solution documents from configs and contexts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate generic solution from program config
  python modular_solution_generator.py --program ap_automation
  
  # Generate customer-specific solution
  python modular_solution_generator.py --program ap_automation --customer trip_com
  
  # List available programs
  python modular_solution_generator.py --list-programs
  
  # List available contexts
  python modular_solution_generator.py --list-contexts
        """
    )
    
    parser.add_argument('--program', help='Program type (e.g., ap_automation)')
    parser.add_argument('--customer', help='Customer name for context')
    parser.add_argument('--list-programs', action='store_true', 
                       help='List available program configs')
    parser.add_argument('--list-contexts', action='store_true',
                       help='List available customer contexts')
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = ModularSolutionGenerator()
    
    if args.list_programs:
        print("Available program configurations:")
        print("-" * 40)
        config_dir = generator.config_loader.config_dir
        for config_file in sorted(config_dir.glob("*.yaml")):
            program = config_file.stem
            if not program.endswith('_enhanced'):
                print(f"  {program}")
        return 0
    
    if args.list_contexts:
        print("Available customer contexts:")
        print("-" * 40)
        context_dir = generator.context_loader.context_dir
        for context_file in sorted(context_dir.glob("*.json")):
            customer = context_file.stem.replace('_context', '').replace('_v2', '')
            print(f"  {customer}")
        return 0
    
    if not args.program:
        parser.print_help()
        return 1
    
    try:
        # Generate document
        output_path = generator.generate(args.program, args.customer)
        print(f"\nSuccess! Document saved to: {output_path}")
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
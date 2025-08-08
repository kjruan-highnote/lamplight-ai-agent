#!/usr/bin/env python3
"""
Workflow Diagram Generator with Template Support

Generates Mermaid sequence diagram templates with alias support.
Creates reusable templates that can be customized for different customers and vendors.
"""

import yaml
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class WorkflowDiagramGenerator:
    """Generate Mermaid sequence diagram templates with alias support"""
    
    def __init__(self, base_dir: Path = None):
        """Initialize generator with base directory"""
        if base_dir is None:
            base_dir = Path(__file__).parent.parent
        
        self.base_dir = base_dir
        self.programs_dir = base_dir / "data" / "programs"
        self.templates_dir = base_dir / "data" / "sequence_templates"
        self.sequences_dir = base_dir / "data" / "sequences"
        
        # Create directories
        self.templates_dir.mkdir(parents=True, exist_ok=True)
        self.sequences_dir.mkdir(parents=True, exist_ok=True)
        
        # Default alias mappings
        self.default_aliases = {
            'CUSTOMER': 'Customer',
            'VENDOR': 'Vendor',
            'WEBHOOK': 'Webhook Service',
            'EXTERNAL': 'External Service',
            'AUTH': 'Auth Service',
            'PAYMENT': 'Payment Processor'
        }
    
    def generate_workflow_template(self, workflow_name: str, workflow_data: Dict[str, Any], 
                                  program_type: str) -> str:
        """Generate a Mermaid sequence diagram template with aliases"""
        diagram_lines = []
        
        # Start Mermaid diagram with alias definitions
        diagram_lines.append("```mermaid")
        diagram_lines.append("sequenceDiagram")
        diagram_lines.append("    autonumber")
        
        # Add title
        title = workflow_data.get('name', workflow_name.replace('_', ' ').title())
        diagram_lines.append(f"    title {title}")
        diagram_lines.append("")
        
        # Define participant aliases
        participants = self._identify_participants_with_aliases(workflow_data)
        
        # Add participant declarations with aliases
        diagram_lines.append("    %%{init: {'theme':'base'}}%%")
        diagram_lines.append("    ")
        diagram_lines.append("    %% Participant Aliases - Replace these with actual names")
        for alias, default_name in participants:
            diagram_lines.append(f"    participant {alias} as {default_name}")
        
        diagram_lines.append("")  # Empty line for readability
        
        # Add workflow description as note if available
        if 'description' in workflow_data:
            diagram_lines.append(f"    Note over CUSTOMER: {workflow_data['description']}")
            diagram_lines.append("")
        
        # Process workflow steps using aliases
        steps = workflow_data.get('steps', [])
        for i, step in enumerate(steps, 1):
            diagram_lines.extend(self._generate_step_sequence_with_aliases(step, i, len(steps)))
        
        # Add completion note
        diagram_lines.append("")
        diagram_lines.append(f"    Note over CUSTOMER,VENDOR: Workflow Complete")
        
        diagram_lines.append("```")
        
        return "\n".join(diagram_lines)
    
    def _identify_participants_with_aliases(self, workflow_data: Dict[str, Any]) -> List[Tuple[str, str]]:
        """Identify participants and return as (alias, default_name) tuples"""
        participants = [
            ("CUSTOMER", "{{CUSTOMER_NAME}}"),
            ("VENDOR", "{{VENDOR_NAME}}")
        ]
        
        # Check for webhook/external services
        steps = workflow_data.get('steps', [])
        has_webhook = False
        has_external = False
        has_auth = False
        has_payment = False
        
        for step in steps:
            op_name = step.get('operation', '').lower()
            if any(keyword in op_name for keyword in ['webhook', 'event', 'notification']) and not has_webhook:
                participants.append(("WEBHOOK", "{{WEBHOOK_SERVICE}}"))
                has_webhook = True
            if any(keyword in op_name for keyword in ['external', 'third']) and not has_external:
                participants.append(("EXTERNAL", "{{EXTERNAL_SERVICE}}"))
                has_external = True
            if any(keyword in op_name for keyword in ['auth', 'authenticate', 'authorize']) and not has_auth:
                participants.append(("AUTH", "{{AUTH_SERVICE}}"))
                has_auth = True
            if any(keyword in op_name for keyword in ['payment', 'transaction', 'charge']) and not has_payment:
                participants.append(("PAYMENT", "{{PAYMENT_PROCESSOR}}"))
                has_payment = True
        
        return participants
    
    def _generate_step_sequence_with_aliases(self, step: Dict[str, Any], step_num: int, 
                                            total_steps: int) -> List[str]:
        """Generate sequence lines using aliases"""
        lines = []
        operation = step.get('operation', 'Unknown')
        required = step.get('required', False)
        condition = step.get('condition', '')
        description = step.get('description', '')
        
        # Determine actors using aliases
        source_alias, target_alias = self._determine_actor_aliases(operation)
        
        # Add condition as alt block if present
        if condition:
            lines.append(f"    alt {condition}")
            indent = "        "
        else:
            indent = "    "
        
        # Generate the main interaction
        req_marker = " [Required]" if required else ""
        lines.append(f"{indent}{source_alias}->>+{target_alias}: {operation}{req_marker}")
        
        # Add description as note if available
        if description:
            lines.append(f"{indent}Note right of {target_alias}: {description[:50]}...")
        
        # Add response
        response_type = self._determine_response_type(operation)
        lines.append(f"{indent}{target_alias}-->>-{source_alias}: {response_type}")
        
        # Close alt block if condition was present
        if condition:
            lines.append("    end")
        
        # Add separation between steps (except last)
        if step_num < total_steps:
            lines.append("")
        
        return lines
    
    def _determine_actor_aliases(self, operation: str) -> Tuple[str, str]:
        """Determine source and target actor aliases for an operation"""
        op_lower = operation.lower()
        
        # Default: Customer interacts with Vendor
        source = "CUSTOMER"
        target = "VENDOR"
        
        # Special cases for other participants
        if any(keyword in op_lower for keyword in ['webhook', 'event', 'notification']):
            if 'callback' in op_lower or 'notify' in op_lower:
                source = "VENDOR"
                target = "CUSTOMER"
            else:
                source = "CUSTOMER"
                target = "WEBHOOK"
        elif any(keyword in op_lower for keyword in ['external', 'third']):
            target = "EXTERNAL"
        elif any(keyword in op_lower for keyword in ['auth', 'authenticate']):
            target = "AUTH"
        elif any(keyword in op_lower for keyword in ['payment', 'charge', 'transaction']):
            if 'process' in op_lower or 'charge' in op_lower:
                target = "PAYMENT"
        
        return source, target
    
    def _determine_response_type(self, operation: str) -> str:
        """Determine the response type based on operation"""
        op_lower = operation.lower()
        
        if 'create' in op_lower:
            return "Created (201)"
        elif 'update' in op_lower or 'modify' in op_lower:
            return "Updated (200)"
        elif 'delete' in op_lower or 'remove' in op_lower:
            return "Deleted (204)"
        elif 'get' in op_lower or 'list' in op_lower or 'query' in op_lower:
            return "Data Response (200)"
        elif 'activate' in op_lower or 'enable' in op_lower:
            return "Activated (200)"
        elif 'suspend' in op_lower or 'disable' in op_lower:
            return "Suspended (200)"
        elif 'simulate' in op_lower:
            return "Simulation Complete"
        else:
            return "Success (200)"
    
    def generate_program_templates(self, program_type: str) -> Dict[str, str]:
        """Generate template diagrams for all workflows in a program"""
        # Load program configuration
        yaml_path = self.programs_dir / f"{program_type}.yaml"
        if not yaml_path.exists():
            yaml_path = self.programs_dir / f"{program_type}_generated.yaml"
        
        if not yaml_path.exists():
            raise FileNotFoundError(f"Program configuration not found: {program_type}")
        
        with open(yaml_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Create program-specific template directory
        program_template_dir = self.templates_dir / program_type
        program_template_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate templates for each workflow
        templates = {}
        workflows = config.get('workflows', {})
        
        for workflow_name, workflow_data in workflows.items():
            # Generate template
            template = self.generate_workflow_template(workflow_name, workflow_data, program_type)
            
            # Save template file
            template_file = program_template_dir / f"{workflow_name}_template.md"
            with open(template_file, 'w') as f:
                f.write(f"# {workflow_data.get('name', workflow_name.title())} Workflow Template\n\n")
                f.write(f"Program: {program_type}\n\n")
                f.write("## Template Variables\n\n")
                f.write("Replace the following placeholders with actual values:\n\n")
                f.write("- `{{CUSTOMER_NAME}}`: Your customer/subscriber name (e.g., TripLink.com)\n")
                f.write("- `{{VENDOR_NAME}}`: The vendor name (e.g., Highnote)\n")
                f.write("- `{{WEBHOOK_SERVICE}}`: Webhook service name if applicable\n")
                f.write("- `{{EXTERNAL_SERVICE}}`: External service name if applicable\n")
                f.write("- `{{AUTH_SERVICE}}`: Authentication service name if applicable\n")
                f.write("- `{{PAYMENT_PROCESSOR}}`: Payment processor name if applicable\n\n")
                f.write("## Diagram\n\n")
                f.write(template)
                f.write("\n")
            
            templates[workflow_name] = str(template_file)
            logger.info(f"Generated template: {template_file}")
        
        # Create a combined template file
        combined_template = program_template_dir / "all_workflows_template.md"
        with open(combined_template, 'w') as f:
            f.write(f"# All Workflow Templates for {program_type}\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("## How to Use These Templates\n\n")
            f.write("1. Replace placeholder values in participant declarations\n")
            f.write("2. Customize operation names and descriptions as needed\n")
            f.write("3. Add or remove steps based on your specific implementation\n\n")
            f.write("## Template Variables\n\n")
            f.write("- `CUSTOMER`: Customer/Subscriber alias\n")
            f.write("- `VENDOR`: Primary vendor/service provider alias\n")
            f.write("- `WEBHOOK`: Webhook service alias (if used)\n")
            f.write("- `EXTERNAL`: External service alias (if used)\n\n")
            f.write("---\n\n")
            
            for workflow_name, workflow_data in workflows.items():
                f.write(f"## {workflow_data.get('name', workflow_name.title())}\n\n")
                template = self.generate_workflow_template(workflow_name, workflow_data, program_type)
                f.write(template)
                f.write("\n\n---\n\n")
        
        templates['all'] = str(combined_template)
        
        return templates
    
    def instantiate_template(self, template_path: Path, replacements: Dict[str, str], 
                            output_path: Path = None) -> str:
        """Instantiate a template with specific values"""
        # Read template
        with open(template_path, 'r') as f:
            content = f.read()
        
        # Replace placeholders
        for placeholder, value in replacements.items():
            # Replace in participant declarations
            content = content.replace(f"{{{{{placeholder}}}}}", value)
            # Also replace alias references if needed
            if placeholder.endswith('_NAME'):
                alias = placeholder.replace('_NAME', '')
                if alias in self.default_aliases:
                    # Update participant declaration
                    old_pattern = f"participant {alias} as {{{{{placeholder}}}}}"
                    new_pattern = f"participant {alias} as {value}"
                    content = content.replace(old_pattern, new_pattern)
        
        # Save if output path provided
        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                f.write(content)
            logger.info(f"Instantiated template saved to: {output_path}")
        
        return content
    
    def batch_instantiate(self, program_type: str, customer_name: str, vendor_name: str,
                         additional_replacements: Dict[str, str] = None) -> Dict[str, str]:
        """Instantiate all templates for a program with specific values"""
        # Base replacements
        replacements = {
            'CUSTOMER_NAME': customer_name,
            'VENDOR_NAME': vendor_name
        }
        
        # Add any additional replacements
        if additional_replacements:
            replacements.update(additional_replacements)
        
        # Get all templates
        template_dir = self.templates_dir / program_type
        if not template_dir.exists():
            raise FileNotFoundError(f"No templates found for program: {program_type}")
        
        # Create output directory
        output_dir = self.sequences_dir / program_type / customer_name.lower().replace(' ', '_').replace('.', '')
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Instantiate each template
        instantiated = {}
        for template_file in template_dir.glob("*_template.md"):
            # Get workflow name
            workflow_name = template_file.stem.replace('_template', '')
            
            # Create output path
            output_file = output_dir / f"{workflow_name}.md"
            
            # Instantiate
            content = self.instantiate_template(template_file, replacements, output_file)
            instantiated[workflow_name] = str(output_file)
        
        logger.info(f"Instantiated {len(instantiated)} templates for {customer_name}")
        
        return instantiated


def main():
    """Main CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate Mermaid sequence diagram templates with alias support',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate templates for a specific program
  python workflow_diagram_generator.py --program ap_automation --generate-templates
  
  # Instantiate templates with specific values
  python workflow_diagram_generator.py --program ap_automation --instantiate \\
      --customer "TripLink.com" --vendor "Highnote"
  
  # Generate templates for all programs
  python workflow_diagram_generator.py --all-templates
        """
    )
    
    parser.add_argument('--program', help='Program type')
    parser.add_argument('--generate-templates', action='store_true', 
                       help='Generate template files')
    parser.add_argument('--all-templates', action='store_true',
                       help='Generate templates for all programs')
    parser.add_argument('--instantiate', action='store_true',
                       help='Instantiate templates with specific values')
    parser.add_argument('--customer', help='Customer name for instantiation')
    parser.add_argument('--vendor', help='Vendor name for instantiation')
    parser.add_argument('--webhook-service', help='Webhook service name')
    parser.add_argument('--external-service', help='External service name')
    parser.add_argument('--output-dir', help='Custom output directory')
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = WorkflowDiagramGenerator()
    
    if args.output_dir:
        generator.sequences_dir = Path(args.output_dir)
        generator.sequences_dir.mkdir(parents=True, exist_ok=True)
    
    if args.all_templates:
        # Generate templates for all programs
        for yaml_file in generator.programs_dir.glob("*.yaml"):
            program_type = yaml_file.stem
            if not program_type.endswith('_generated'):
                try:
                    templates = generator.generate_program_templates(program_type)
                    print(f"✓ Generated {len(templates)} templates for {program_type}")
                except Exception as e:
                    print(f"✗ Failed for {program_type}: {e}")
    
    elif args.program and args.generate_templates:
        # Generate templates for specific program
        try:
            templates = generator.generate_program_templates(args.program)
            print(f"Successfully generated {len(templates) - 1} workflow templates:")
            for workflow, path in templates.items():
                if workflow != 'all':
                    print(f"  - {workflow}: {path}")
            print(f"\nCombined templates: {templates['all']}")
        except Exception as e:
            print(f"Error: {e}")
            return 1
    
    elif args.program and args.instantiate:
        # Instantiate templates
        if not args.customer or not args.vendor:
            print("Error: --customer and --vendor are required for instantiation")
            return 1
        
        additional = {}
        if args.webhook_service:
            additional['WEBHOOK_SERVICE'] = args.webhook_service
        if args.external_service:
            additional['EXTERNAL_SERVICE'] = args.external_service
        
        try:
            instantiated = generator.batch_instantiate(
                args.program, args.customer, args.vendor, additional
            )
            print(f"Successfully instantiated {len(instantiated)} diagrams for {args.customer}:")
            for workflow, path in instantiated.items():
                print(f"  - {workflow}: {path}")
        except Exception as e:
            print(f"Error: {e}")
            return 1
    
    else:
        parser.print_help()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
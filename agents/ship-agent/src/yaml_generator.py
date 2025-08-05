"""
YAML Configuration Generator from Postman Collections
Automatically generates comprehensive YAML configs from exported operations
"""
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Set
from collections import defaultdict
import re
from datetime import datetime


class YAMLConfigGenerator:
    """
    Generates YAML configuration files from exported Postman operations
    """
    
    def __init__(self, operations_dir: str = "data/operations", programs_dir: str = "data/programs"):
        self.operations_dir = Path(operations_dir)
        self.programs_dir = Path(programs_dir)
        self.programs_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_yaml_from_operations(self, operations_file: str, program_type: str = None) -> Dict[str, Any]:
        """
        Generate YAML configuration from operations JSON file
        """
        # Load operations
        operations_path = Path(operations_file)
        if not operations_path.is_absolute():
            operations_path = self.operations_dir / operations_file
            
        with open(operations_path, 'r') as f:
            operations = json.load(f)
        
        # Determine program type from filename if not provided
        if not program_type:
            program_type = operations_path.stem.replace('_operations', '')
        
        # Analyze operations
        analysis = self._analyze_operations(operations)
        
        # Generate YAML structure
        yaml_config = self._generate_yaml_structure(program_type, analysis, operations)
        
        # Save YAML file
        output_file = self.programs_dir / f"{program_type}.yaml"
        with open(output_file, 'w') as f:
            yaml.dump(yaml_config, f, default_flow_style=False, sort_keys=False, width=120)
        
        print(f"Generated YAML config: {output_file}")
        return yaml_config
    
    def _analyze_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze operations to extract categories, patterns, and flows
        """
        analysis = {
            'categories': defaultdict(list),
            'operation_types': defaultdict(int),
            'common_patterns': defaultdict(set),
            'entity_types': set(),
            'action_types': set(),
            'total_operations': len(operations)
        }
        
        for op in operations:
            # Extract category
            category = op.get('metadata', {}).get('category', 'uncategorized')
            op_name = op.get('name', 'Unknown')
            
            # Clean up category name
            category = self._normalize_category(category)
            
            analysis['categories'][category].append(op_name)
            
            # Analyze operation type
            op_type = op.get('operation_type', 'unknown')
            analysis['operation_types'][op_type] += 1
            
            # Extract patterns from operation name
            entities, actions = self._extract_patterns_from_name(op_name)
            analysis['entity_types'].update(entities)
            analysis['action_types'].update(actions)
            
            # Extract common fields
            if 'graphql' in op and 'variables' in op['graphql']:
                self._extract_common_fields(op['graphql']['variables'], analysis['common_patterns'])
        
        return analysis
    
    def _normalize_category(self, category: str) -> str:
        """Normalize category name"""
        # Convert to snake_case
        category = re.sub(r'[^\w\s]', '', category)
        category = re.sub(r'\s+', '_', category)
        return category.lower()
    
    def _extract_patterns_from_name(self, op_name: str) -> tuple:
        """Extract entity types and action types from operation name"""
        entities = set()
        actions = set()
        
        # Common entities in financial APIs
        entity_patterns = [
            'AccountHolder', 'Account', 'Card', 'Transaction', 'Payment',
            'Application', 'Document', 'Statement', 'Transfer', 'Webhook',
            'Notification', 'Report', 'Rule', 'Limit', 'Authorization'
        ]
        
        # Common actions
        action_patterns = [
            'Create', 'Get', 'Update', 'Delete', 'Issue', 'Activate',
            'Suspend', 'Close', 'Approve', 'Deny', 'Simulate', 'Generate',
            'Attach', 'Detach', 'Search', 'List', 'Process'
        ]
        
        for entity in entity_patterns:
            if entity in op_name:
                entities.add(entity)
        
        for action in action_patterns:
            if op_name.startswith(action):
                actions.add(action)
        
        return entities, actions
    
    def _extract_common_fields(self, variables: Any, common_patterns: defaultdict):
        """Extract common field patterns from GraphQL variables"""
        if isinstance(variables, dict):
            for key, value in variables.items():
                if isinstance(value, str) and value.startswith('{{') and value.endswith('}}'):
                    field_name = value.strip('{}')
                    common_patterns[key].add(field_name)
                elif isinstance(value, dict):
                    self._extract_common_fields(value, common_patterns)
                elif isinstance(value, list):
                    for item in value:
                        self._extract_common_fields(item, common_patterns)
    
    def _generate_yaml_structure(self, program_type: str, analysis: Dict[str, Any], 
                                operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate complete YAML structure"""
        # Base structure
        yaml_config = {
            'program_type': program_type,
            'vendor': 'highnote',
            'version': '1.0.0',
            'api_type': 'graphql',
            'metadata': self._generate_metadata(program_type),
            'categories': self._generate_categories(analysis['categories']),
            'dimensions': self._generate_dimensions(program_type, analysis),
            'operation_flows': self._generate_operation_flows(program_type, analysis, operations),
            'tags': self._generate_tags(program_type)
        }
        
        return yaml_config
    
    def _generate_metadata(self, program_type: str) -> Dict[str, Any]:
        """Generate metadata section"""
        program_title = program_type.replace('_', ' ').title()
        
        return {
            'description': f"{program_title} Program - Highnote",
            'base_url': "{{apiUrl}}",
            'authentication': {
                'type': 'bearer',
                'header': 'Authorization'
            }
        }
    
    def _generate_categories(self, categories: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Generate categories section with operations"""
        category_list = []
        
        # Sort categories by number of operations (descending)
        sorted_categories = sorted(categories.items(), key=lambda x: len(x[1]), reverse=True)
        
        for category_name, operations in sorted_categories:
            # Generate description based on operations
            description = self._generate_category_description(category_name, operations)
            
            category_list.append({
                'name': category_name,
                'description': description,
                'operations': sorted(operations)
            })
        
        return category_list
    
    def _generate_category_description(self, category_name: str, operations: List[str]) -> str:
        """Generate description for a category based on its operations"""
        # Analyze operations to determine category purpose
        category_title = category_name.replace('_', ' ').title()
        
        descriptions = {
            'api_key_management': "API key creation, retrieval, and management",
            'organization': "Organization setup and configuration",
            'setup': "Initial setup and system configuration",
            'onboarding': "Account holder onboarding and KYC processes",
            'person_account_holder': "Individual account holder management",
            'business_account_holder': "Business account holder management",
            'financial_accounts': "Financial account creation and management",
            'payment_cards': "Payment card issuance and lifecycle management",
            'transactions': "Transaction processing and management",
            'authorization_controls': "Spend rules and authorization controls",
            'funding': "Account funding and money movement",
            'reporting': "Reports, statements, and notifications",
            'webhooks': "Webhook configuration and management",
            'simulation': "Transaction and event simulation for testing"
        }
        
        return descriptions.get(category_name, f"{category_title} operations")
    
    def _generate_dimensions(self, program_type: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate dimensions based on program type"""
        base_dimensions = {
            'customer_segments': self._get_customer_segments(program_type),
            'program_variants': self._get_program_variants(program_type),
            'features': self._get_features(program_type)
        }
        
        # Add program-specific dimensions
        if 'credit' in program_type:
            base_dimensions['risk_tiers'] = ['prime', 'near_prime', 'subprime', 'super_prime', 'thin_file']
            base_dimensions['underwriting_methods'] = ['automated', 'manual_review', 'collaborative', 'custom']
        
        if 'commercial' in program_type or 'business' in program_type:
            base_dimensions['business_types'] = ['llc', 'corporation', 'partnership', 'sole_proprietorship', 'nonprofit']
        
        if 'prepaid' in program_type:
            base_dimensions['funding_sources'] = ['direct_deposit', 'ach_transfer', 'card_load', 'cash_load', 'employer_funded']
        
        if 'ap_automation' in program_type:
            base_dimensions['integration_types'] = ['quickbooks', 'sap', 'oracle', 'netsuite', 'custom_api']
            base_dimensions['payment_methods'] = ['ach', 'wire', 'check', 'virtual_card', 'cross_border']
        
        # Always include card types if payment cards are involved
        if any(cat in analysis['categories'] for cat in ['payment_cards', 'payment_card', 'cards']):
            base_dimensions['card_types'] = ['physical', 'virtual', 'both']
        
        return base_dimensions
    
    def _get_customer_segments(self, program_type: str) -> List[str]:
        """Get customer segments based on program type"""
        if 'consumer' in program_type:
            return ['retail', 'premium', 'student', 'senior', 'mass_market']
        elif 'commercial' in program_type or 'business' in program_type:
            return ['small_business', 'mid_market', 'enterprise', 'startup', 'nonprofit']
        else:
            return ['standard', 'premium', 'enterprise']
    
    def _get_program_variants(self, program_type: str) -> List[str]:
        """Get program variants based on program type"""
        if 'credit' in program_type:
            return ['standard_credit', 'secured_credit', 'rewards_cashback', 'rewards_points', 'premium_travel', 'student_credit']
        elif 'prepaid' in program_type:
            return ['general_purpose', 'payroll', 'gift', 'teen', 'travel', 'expense']
        elif 'charge' in program_type:
            return ['standard_charge', 'corporate_charge', 'premium_charge']
        elif 'ap_automation' in program_type:
            return ['standard_ap', 'invoice_management', 'expense_management', 'procurement', 'full_automation']
        else:
            return ['standard', 'premium', 'custom']
    
    def _get_features(self, program_type: str) -> List[str]:
        """Get features based on program type"""
        features = ['digital_wallet', 'contactless', 'international']
        
        if 'credit' in program_type:
            features.extend(['rewards', 'balance_transfer', 'cash_advance'])
        elif 'prepaid' in program_type:
            features.extend(['reload', 'bill_pay', 'atm_access'])
        elif 'commercial' in program_type:
            features.extend(['expense_reporting', 'receipt_capture', 'accounting_integration'])
        
        return features
    
    def _generate_operation_flows(self, program_type: str, analysis: Dict[str, Any], 
                                 operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate operation flows based on available operations"""
        flows = {}
        
        # Get all operation names for checking availability
        all_operations = set()
        for ops in analysis['categories'].values():
            all_operations.update(ops)
        
        # Standard onboarding flow
        flows['standard_onboarding'] = self._create_onboarding_flow(program_type, all_operations)
        
        # Card issuance flow
        if any(op for op in all_operations if 'Card' in op):
            flows['card_issuance'] = self._create_card_flow(program_type, all_operations)
        
        # Transaction flow
        if any(op for op in all_operations if 'Transaction' in op or 'Authorization' in op):
            flows['transaction_processing'] = self._create_transaction_flow(all_operations)
        
        # Funding flow
        if any(op for op in all_operations if 'Transfer' in op or 'ACH' in op):
            flows['funding_setup'] = self._create_funding_flow(all_operations)
        
        # Spend controls flow
        if any(op for op in all_operations if 'SpendRule' in op or 'Velocity' in op):
            flows['spend_controls'] = self._create_spend_controls_flow(all_operations)
        
        # Manual review flow
        if any(op for op in all_operations if 'Review' in op or 'Deny' in op):
            flows['manual_review_process'] = self._create_manual_review_flow(all_operations)
        
        # Remove empty flows
        flows = {k: v for k, v in flows.items() if v.get('steps')}
        
        return flows
    
    def _create_onboarding_flow(self, program_type: str, available_ops: Set[str]) -> Dict[str, Any]:
        """Create onboarding flow based on available operations"""
        steps = []
        
        # Determine account holder type
        if 'consumer' in program_type:
            if 'CreateUSPersonAccountHolder' in available_ops:
                steps.append('CreateUSPersonAccountHolder')
            elif 'CreatePersonAccountHolder' in available_ops:
                steps.append('CreatePersonAccountHolder')
        elif 'commercial' in program_type or 'business' in program_type:
            if 'CreateBusinessAccountHolder' in available_ops:
                steps.append('CreateBusinessAccountHolder')
        
        # Application process
        if 'CreatePersonAccountHolderApplication' in available_ops:
            steps.append('CreatePersonAccountHolderApplication')
        
        # Financial account
        if 'IssueFinancialAccountForApplication' in available_ops:
            steps.append('IssueFinancialAccountForApplication')
        elif 'IssueFinancialAccount' in available_ops:
            steps.append('IssueFinancialAccount')
        
        # Credit limit (for credit programs)
        if 'credit' in program_type and 'SetCreditLimitForFinancialAccount' in available_ops:
            steps.append('SetCreditLimitForFinancialAccount')
        
        # Card issuance
        if 'IssuePaymentCardForFinancialAccount' in available_ops:
            steps.append('IssuePaymentCardForFinancialAccount')
        elif 'IssuePaymentCard' in available_ops:
            steps.append('IssuePaymentCard')
        
        # Card activation
        if 'ActivatePaymentCard' in available_ops:
            steps.append('ActivatePaymentCard')
        
        return {
            'description': f"Standard onboarding flow for {program_type.replace('_', ' ')}",
            'steps': steps
        }
    
    def _create_card_flow(self, program_type: str, available_ops: Set[str]) -> Dict[str, Any]:
        """Create card management flow"""
        steps = []
        
        # Card issuance
        if 'IssuePaymentCardForFinancialAccount' in available_ops:
            steps.append('IssuePaymentCardForFinancialAccount')
        elif 'IssuePaymentCard' in available_ops:
            steps.append('IssuePaymentCard')
        
        # PIN setup
        if 'GenerateClientTokenToSetPIN' in available_ops:
            steps.append('GenerateClientTokenToSetPIN')
            if 'SetPinForPaymentCard' in available_ops:
                steps.append('SetPinForPaymentCard')
        
        # Physical card
        if 'OrderPhysicalPaymentCard' in available_ops:
            steps.append('OrderPhysicalPaymentCard')
        
        # Activation
        if 'ActivatePaymentCard' in available_ops:
            steps.append('ActivatePaymentCard')
        
        return {
            'description': "Payment card issuance and activation",
            'steps': steps
        }
    
    def _create_transaction_flow(self, available_ops: Set[str]) -> Dict[str, Any]:
        """Create transaction processing flow"""
        steps = []
        
        # Authorization
        if 'SimulateAuthorization' in available_ops:
            steps.append('SimulateAuthorization')
        
        # Clearing
        if 'SimulateClearing' in available_ops:
            steps.append('SimulateClearing')
        
        # Get transaction
        if 'GetTransactionEvent' in available_ops:
            steps.append('GetTransactionEvent')
        
        return {
            'description': "Transaction processing and settlement",
            'steps': steps
        }
    
    def _create_funding_flow(self, available_ops: Set[str]) -> Dict[str, Any]:
        """Create funding flow"""
        steps = []
        
        # External account
        if 'AddExternalBankAccountVerifiedThroughPlaid' in available_ops:
            steps.append('AddExternalBankAccountVerifiedThroughPlaid')
        
        # ACH transfer
        if 'InitiateFundsDepositACHTransfer' in available_ops:
            steps.append('InitiateFundsDepositACHTransfer')
        elif 'InitiateACHTransfer' in available_ops:
            steps.append('InitiateACHTransfer')
        
        # Direct deposit
        if 'GenerateDirectDepositDetailClientToken' in available_ops:
            steps.append('GenerateDirectDepositDetailClientToken')
        
        return {
            'description': "Account funding and money movement",
            'steps': steps
        }
    
    def _create_spend_controls_flow(self, available_ops: Set[str]) -> Dict[str, Any]:
        """Create spend controls flow"""
        steps = []
        
        # Merchant category rules
        if 'CreateMerchantCategorySpendRule' in available_ops:
            steps.append('CreateMerchantCategorySpendRule')
        
        # Amount limits
        if 'CreateAmountLimitSpendRule' in available_ops:
            steps.append('CreateAmountLimitSpendRule')
        
        # Velocity rules
        if 'CreateVelocityRule' in available_ops:
            steps.append('CreateVelocityRule')
        
        # Attach to card
        if 'AttachSpendRuleToPaymentCard' in available_ops:
            steps.append('AttachSpendRuleToPaymentCard')
        
        if 'AttachPaymentCardVelocityRule' in available_ops:
            steps.append('AttachPaymentCardVelocityRule')
        
        return {
            'description': "Configure spending controls and limits",
            'steps': steps
        }
    
    def _create_manual_review_flow(self, available_ops: Set[str]) -> Dict[str, Any]:
        """Create manual review flow"""
        steps = []
        
        # Create in review
        if 'CreatePersonAccountHolderInReview' in available_ops:
            steps.append('CreatePersonAccountHolderInReview')
        elif 'CreateBusinessAccountHolderInReview' in available_ops:
            steps.append('CreateBusinessAccountHolderInReview')
        
        # Document upload
        if 'StartDocumentUploadSession' in available_ops:
            steps.append('StartDocumentUploadSession')
            steps.append('GenerateDocumentUploadClientToken')
        
        # Review application
        if 'GetPersonAccountHolderApplication' in available_ops:
            steps.append('GetPersonAccountHolderApplication')
        
        # Approve or deny
        if 'ApproveApplicationUnderwriting' in available_ops:
            steps.append('ApproveApplicationUnderwriting')
        
        return {
            'description': "Manual review process for applications",
            'steps': steps
        }
    
    def _generate_tags(self, program_type: str) -> List[str]:
        """Generate relevant tags"""
        tags = [program_type, 'graphql', 'highnote']
        
        # Add type-specific tags
        if 'credit' in program_type:
            tags.append('credit_card')
        elif 'prepaid' in program_type:
            tags.append('prepaid_card')
        elif 'charge' in program_type:
            tags.append('charge_card')
        
        if 'consumer' in program_type:
            tags.append('b2c')
        elif 'commercial' in program_type or 'business' in program_type:
            tags.append('b2b')
        
        return tags
    
    def generate_all_yamls(self):
        """Generate YAML configs for all operations files"""
        operations_files = list(self.operations_dir.glob("*_operations.json"))
        
        print(f"Found {len(operations_files)} operations files")
        print("=" * 60)
        
        for ops_file in operations_files:
            print(f"\nProcessing: {ops_file.name}")
            try:
                self.generate_yaml_from_operations(ops_file.name)
            except Exception as e:
                print(f"  Error: {e}")
        
        print(f"\nGenerated {len(operations_files)} YAML configuration files")


def main():
    """Main function for CLI usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate YAML configs from Postman operations')
    parser.add_argument('operations_file', nargs='?', help='Operations JSON file to process')
    parser.add_argument('--program-type', help='Program type (if not inferred from filename)')
    parser.add_argument('--all', action='store_true', help='Generate YAMLs for all operations files')
    parser.add_argument('--operations-dir', default='data/operations', help='Operations directory')
    parser.add_argument('--programs-dir', default='data/programs', help='Output programs directory')
    
    args = parser.parse_args()
    
    generator = YAMLConfigGenerator(args.operations_dir, args.programs_dir)
    
    if args.all:
        generator.generate_all_yamls()
    elif args.operations_file:
        generator.generate_yaml_from_operations(args.operations_file, args.program_type)
    else:
        print("Please specify an operations file or use --all to process all files")
        parser.print_help()


if __name__ == "__main__":
    main()
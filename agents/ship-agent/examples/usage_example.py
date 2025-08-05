"""
Example usage of the simplified Ship Agent
"""
import asyncio
import json
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from src.ship_agent import ShipAgent
from src.postman_to_mongodb_migrator import PostmanToMongoDBMigrator


async def example_usage():
    """
    Demonstrate how to use the simplified Ship Agent
    """
    
    # 1. First, migrate Postman collection (if not already done)
    print("Step 1: Migrate Postman collection to operations...")
    migrator = PostmanToMongoDBMigrator()
    postman_file = Path("data/postman/Consumer Credit.postman_collection.json")
    
    if postman_file.exists():
        result = migrator.migrate_collection(str(postman_file), "consumer_credit")
        print(f"  Migrated {result['total_operations']} operations")
    
    # 2. Initialize Ship Agent
    print("\nStep 2: Initialize Ship Agent...")
    ship_agent = ShipAgent()
    
    # 3. Generate queries for specific context
    print("\nStep 3: Generate queries for a specific customer...")
    context = {
        'customer': 'BankX',
        'environment': 'production',
        'region': 'US'
    }
    
    # Generate all onboarding operations
    queries = await ship_agent.generate_queries(
        program_type='consumer_credit',
        dimensions=context,
        options={'categories': ['onboarding', 'issuance']}
    )
    
    print(f"  Generated {len(queries['operations'])} operations")
    
    # 4. Generate a Postman collection
    print("\nStep 4: Generate Postman collection...")
    collection = await ship_agent.generate_collection(
        program_type='consumer_credit',
        dimensions=context,
        output_format='postman',
        options={'categories': ['onboarding', 'issuance']}
    )
    
    # Save collection
    output_file = Path("data/generated/BankX_consumer_credit.postman_collection.json")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump(collection, f, indent=2)
    
    print(f"  Saved collection to {output_file}")
    
    # 5. Generate test data
    print("\nStep 5: Generate test data...")
    test_data = await ship_agent.generate_test_data(
        program_type='consumer_credit',
        dimensions=context,
        options={'operations': ['CreateUSPersonAccountHolder', 'IssueFinancialAccountForApplication']}
    )
    
    print(f"  Generated test data for {len(test_data['test_cases'])} operations")
    
    # Print sample test case
    if test_data['test_cases']:
        print("\nSample test case:")
        print(f"  Operation: {test_data['test_cases'][0]['operation']}")
        print(f"  Variables: {json.dumps(test_data['test_cases'][0]['variables'], indent=4)[:200]}...")
    
    print("\n✅ Example completed successfully!")


async def example_yaml_based_flow():
    """
    Example using YAML configuration for program flows
    """
    print("\n" + "="*50)
    print("YAML-Based Flow Example")
    print("="*50)
    
    # Load YAML config directly
    from src.plugins.program_types.yaml_program_plugin import YAMLProgramPlugin
    
    # Initialize plugin for consumer credit
    plugin = YAMLProgramPlugin('consumer_credit')
    
    # Get available flows
    flows = plugin.config.get('operation_flows', {})
    print("\nAvailable flows:")
    for flow_name, flow_config in flows.items():
        print(f"  - {flow_name}: {flow_config.get('description', 'No description')}")
    
    # Get operations for a specific flow
    onboarding_flow = plugin.get_flow('standard_onboarding')
    print(f"\nStandard onboarding flow steps:")
    for step in onboarding_flow.get('steps', []):
        print(f"  - {step}")
    
    # Get operations by category
    categories = plugin.config.get('categories', [])
    print(f"\nCategories ({len(categories)} total):")
    for cat in categories[:3]:  # Show first 3
        ops = cat.get('operations', [])
        print(f"  - {cat['name']}: {len(ops)} operations")


if __name__ == "__main__":
    # Run the examples
    asyncio.run(example_usage())
    asyncio.run(example_yaml_based_flow())
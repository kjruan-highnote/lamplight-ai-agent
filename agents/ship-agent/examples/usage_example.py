"""
Example usage of the simplified Ship Agent
"""
import asyncio
import json
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from src.ship_agent_simplified import SimplifiedShipAgent
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
    ship_agent = SimplifiedShipAgent()
    
    # 3. Generate queries for specific context
    print("\nStep 3: Generate queries for a specific customer...")
    context = {
        'customer': 'BankX',
        'environment': 'production',
        'region': 'US'
    }
    
    # Note: generate_queries method doesn't exist in simplified version
    # We'll skip this step and go directly to collection generation
    
    # 4. Generate a Postman collection
    print("\nStep 4: Generate Postman collection...")
    collection = await ship_agent.generate_collection(
        program_type='consumer_credit',
        dimensions=context,
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
    Example showing available program types and flows
    """
    print("\n" + "="*50)
    print("Available Programs Example")
    print("="*50)
    
    ship_agent = SimplifiedShipAgent()
    
    # List available programs
    programs = list(ship_agent.operations_cache.keys())
    print(f"\nAvailable programs ({len(programs)} total):")
    for prog in sorted(programs)[:10]:  # Show first 10
        print(f"  - {prog}")
    
    # Load YAML config for a program
    import yaml
    yaml_file = Path("data/programs/consumer_credit.yaml")
    if yaml_file.exists():
        with open(yaml_file, 'r') as f:
            config = yaml.safe_load(f)
        
        flows = config.get('operation_flows', {})
        print("\nConsumer Credit flows:")
        for flow_name, flow_config in list(flows.items())[:3]:
            print(f"  - {flow_name}: {flow_config.get('description', 'No description')}")
            print(f"    Steps: {', '.join(flow_config.get('steps', [])[:3])}...")


if __name__ == "__main__":
    # Run the examples
    asyncio.run(example_usage())
    asyncio.run(example_yaml_based_flow())
"""
Auto-export all collections from Postman using Postman API
"""
import os
import json
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any


class PostmanAutoExporter:
    """
    Export all collections from Postman workspace using Postman API
    """
    
    def __init__(self, api_key: str):
        """
        Initialize with Postman API key
        
        To get your API key:
        1. Go to https://postman.com
        2. Click on your avatar -> Settings
        3. Go to API keys tab
        4. Generate a new API key
        """
        self.api_key = api_key
        self.base_url = "https://api.getpostman.com"
        self.headers = {
            "X-API-Key": api_key
        }
    
    def get_all_collections(self) -> List[Dict[str, Any]]:
        """Get list of all collections in workspace"""
        url = f"{self.base_url}/collections"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            collections = data.get('collections', [])
            
            print(f"Found {len(collections)} collections")
            return collections
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching collections: {e}")
            return []
    
    def get_collection_details(self, collection_uid: str) -> Dict[str, Any]:
        """Get full details of a specific collection"""
        url = f"{self.base_url}/collections/{collection_uid}"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            return data.get('collection', {})
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching collection {collection_uid}: {e}")
            return {}
    
    def export_all_collections(self, output_dir: str = "data/postman/auto_export") -> Dict[str, Any]:
        """
        Export all collections to JSON files
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Create timestamp for this export
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Get all collections
        collections = self.get_all_collections()
        
        if not collections:
            print("No collections found")
            return {}
        
        exported = {}
        
        for collection in collections:
            collection_name = collection.get('name', 'Unknown')
            collection_uid = collection.get('uid')
            
            if not collection_uid:
                print(f"Skipping {collection_name} - no UID")
                continue
            
            print(f"Exporting: {collection_name}")
            
            # Get full collection details
            collection_data = self.get_collection_details(collection_uid)
            
            if collection_data:
                # Create filename
                safe_name = "".join(c for c in collection_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                filename = f"{safe_name}_{timestamp}.json"
                filepath = output_path / filename
                
                # Save to file
                with open(filepath, 'w') as f:
                    json.dump(collection_data, f, indent=2)
                
                exported[collection_name] = {
                    'file': str(filepath),
                    'uid': collection_uid,
                    'item_count': len(collection_data.get('item', []))
                }
                
                print(f"  ✓ Saved to {filepath}")
            else:
                print(f"  ✗ Failed to export {collection_name}")
        
        # Save export summary
        summary_file = output_path / f"export_summary_{timestamp}.json"
        with open(summary_file, 'w') as f:
            json.dump({
                'timestamp': timestamp,
                'total_collections': len(collections),
                'exported': len(exported),
                'collections': exported
            }, f, indent=2)
        
        print(f"\nExport complete! Summary saved to {summary_file}")
        return exported
    
    def export_workspace_collections(self, workspace_id: str, output_dir: str = "data/postman/workspace_export") -> Dict[str, Any]:
        """
        Export all collections from a specific workspace
        """
        # First get workspace details
        url = f"{self.base_url}/workspaces/{workspace_id}"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            workspace_data = response.json()
            workspace = workspace_data.get('workspace', {})
            
            print(f"Workspace: {workspace.get('name', 'Unknown')}")
            
            # Get collections in workspace
            collections = workspace.get('collections', [])
            
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            exported = {}
            
            for collection in collections:
                collection_uid = collection.get('uid')
                collection_name = collection.get('name', 'Unknown')
                
                if collection_uid:
                    print(f"Exporting: {collection_name}")
                    
                    # Get full collection
                    collection_data = self.get_collection_details(collection_uid)
                    
                    if collection_data:
                        # Save to file
                        safe_name = "".join(c for c in collection_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                        filename = f"{safe_name}.json"
                        filepath = output_path / filename
                        
                        with open(filepath, 'w') as f:
                            json.dump(collection_data, f, indent=2)
                        
                        exported[collection_name] = str(filepath)
                        print(f"  ✓ Saved to {filepath}")
            
            return exported
            
        except requests.exceptions.RequestException as e:
            print(f"Error accessing workspace: {e}")
            return {}
    
    def get_workspaces(self) -> List[Dict[str, Any]]:
        """Get list of all workspaces"""
        url = f"{self.base_url}/workspaces"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            workspaces = data.get('workspaces', [])
            
            print(f"Found {len(workspaces)} workspaces:")
            for ws in workspaces:
                print(f"  - {ws.get('name')} (ID: {ws.get('id')})")
            
            return workspaces
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching workspaces: {e}")
            return []


def main():
    """
    CLI for auto-exporting Postman collections
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='Auto-export Postman collections')
    parser.add_argument('--api-key', help='Postman API key (or set POSTMAN_API_KEY env var)')
    parser.add_argument('--workspace-id', help='Export specific workspace')
    parser.add_argument('--output-dir', default='data/postman/auto_export', help='Output directory')
    parser.add_argument('--list-workspaces', action='store_true', help='List available workspaces')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.getenv('POSTMAN_API_KEY')
    
    if not api_key:
        print("Error: Postman API key required!")
        print("Either pass --api-key or set POSTMAN_API_KEY environment variable")
        print("\nTo get your API key:")
        print("1. Go to https://postman.com")
        print("2. Click on your avatar -> Settings")
        print("3. Go to API keys tab")
        print("4. Generate a new API key")
        return
    
    exporter = PostmanAutoExporter(api_key)
    
    if args.list_workspaces:
        exporter.get_workspaces()
    elif args.workspace_id:
        exporter.export_workspace_collections(args.workspace_id, args.output_dir)
    else:
        exporter.export_all_collections(args.output_dir)


if __name__ == "__main__":
    main()
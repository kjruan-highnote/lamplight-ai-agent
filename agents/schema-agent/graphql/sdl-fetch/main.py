import argparse
import requests
import base64
from graphql import get_introspection_query, build_client_schema, print_schema
import sys

def fetch_schema(endpoint, token, output_path):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {base64.b64encode(token.encode()).decode()}"
    }
    query = get_introspection_query(descriptions=True)

    response = requests.post(endpoint, json={"query": query}, headers=headers)
    if response.status_code != 200:
        print(f"Failed to fetch schema: {response.status_code} {response.text}")
        sys.exit(1)

    data = response.json().get("data")
    if not data:
        print("No data in response")
        sys.exit(1)

    schema = build_client_schema(data)
    sdl = print_schema(schema)

    with open(output_path, "w") as f:
        f.write(sdl)

    print(f"SDL written to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch GraphQL SDL from endpoint")
    parser.add_argument("--graphql-endpoint", required=True, help="GraphQL endpoint URL")
    parser.add_argument("--graphql-token", required=True, help="Bearer token")
    parser.add_argument("--sdl-output", required=True, help="Output file path")

    args = parser.parse_args()

    fetch_schema(args.graphql_endpoint, args.graphql_token, args.sdl_output)


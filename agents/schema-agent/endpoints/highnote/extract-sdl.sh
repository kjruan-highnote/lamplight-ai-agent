#!/bin/bash

# Load variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "ERROR: .env file not found"
  exit 1
fi

# Check required vars
: "${GRAPHQL_ENDPOINT:?Missing GRAPHQL_ENDPOINT}"
: "${GRAPHQL_TOKEN:?Missing GRAPHQL_TOKEN}"
: "${SDL_OUTPUT:?Missing SDL_OUTPUT}"

# Execute binary
../../graphql/sdl-fetch/graphql-sdl-fetch \
  --graphql-endpoint "$GRAPHQL_ENDPOINT" \
  --graphql-token "$GRAPHQL_TOKEN" \
  --sdl-output "$SDL_OUTPUT"

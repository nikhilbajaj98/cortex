#!/bin/sh
# Kong declarative YAML cannot read .env; substitute the consumer API key at container start.
# Source: KONG_TEST_API_KEY (same variable used for cortex-web NEXT_PUBLIC_KONG_API_KEY).
set -eu
KEY="${KONG_TEST_API_KEY:-test-key}"
ESCAPED=$(printf '%s\n' "$KEY" | sed 's/[\/&]/\\&/g')
sed "s/__KONG_CONSUMER_API_KEY__/${ESCAPED}/g" /kong/declarative/kong.template.yml > /tmp/kong-runtime.yml
export KONG_DECLARATIVE_CONFIG=/tmp/kong-runtime.yml
exec /docker-entrypoint.sh kong docker-start

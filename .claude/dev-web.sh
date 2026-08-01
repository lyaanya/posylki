#!/bin/bash
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."
exec pnpm --filter @posylki/web dev

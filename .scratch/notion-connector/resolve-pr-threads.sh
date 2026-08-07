#!/usr/bin/env bash
# Resolve every (unresolved) review thread on PR #1179 in one shot.
#
# Requires the GitHub CLI, authenticated as the PR author:
#   brew install gh && gh auth login
#
# Usage:
#   bash .scratch/notion-connector/resolve-pr-threads.sh
#
# Before running, optionally post the summary reply (see docs/review-fixes.md):
#   gh pr comment 1179 --repo ItzCrazyKns/Vane --body "$(cat /tmp/pr-reply.md)"
set -euo pipefail

PR="${1:-1179}"
REPO="ItzCrazyKns/Vane"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed. Run: brew install gh && gh auth login" >&2
  exit 1
fi

threads_json="$(gh api graphql -f query='
{
  repository(owner: "ItzCrazyKns", name: "Vane") {
    pullRequest(number: '"$PR"') {
      reviewThreads(first: 100) {
        nodes { id isResolved }
      }
    }
  }
}')"

ids="$(printf '%s' "$threads_json" |
  jq -r '.data.repository.pullRequest.reviewThreads.nodes[] |
         select(.isResolved == false) | .id')"

count=0
for id in $ids; do
  gh api graphql -f query='
    mutation {
      resolveReviewThread(input: {threadId: "'"$id"'"}) {
        thread { id isResolved }
      }
    }' >/dev/null
  count=$((count + 1))
done

echo "Resolved $count review thread(s) on $REPO#${PR}."
echo "If any thread fails (stale id), re-run the script."

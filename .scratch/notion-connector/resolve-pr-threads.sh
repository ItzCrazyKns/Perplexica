#!/usr/bin/env bash
# Resolve every unresolved review thread on a GitHub PR in one shot.
#
# Requires the GitHub CLI, authenticated as the PR author. No external jq
# needed — gh bundles its own JSON filter via --jq:
#   brew install gh && gh auth login
#
# Usage:
#   bash .scratch/notion-connector/resolve-pr-threads.sh [PR_NUMBER]
set -euo pipefail

PR="${1:-1179}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed. Run: brew install gh && gh auth login" >&2
  exit 1
fi

FIRST_PAGE_QUERY='{
  repository(owner: "ItzCrazyKns", name: "Vane") {
    pullRequest(number: '"$PR"') {
      reviewThreads(first: 100) {
        nodes { id isResolved }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}'

NEXT_PAGE_QUERY='query($cursor: String) {
  repository(owner: "ItzCrazyKns", name: "Vane") {
    pullRequest(number: '"$PR"') {
      reviewThreads(first: 100, after: $cursor) {
        nodes { id isResolved }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}'

# Emit one line per unresolved thread id, plus a final "__PAGEINFO__"
# line carrying hasNextPage and endCursor (no external jq required).
EXTRACT='(
  .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false) | .id
),
"__PAGEINFO__ " +
  (.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage | tostring) +
  " " + (.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // "")'

ids=""
has_next="true"
cursor=""

while [ "$has_next" = "true" ]; do
  if [ -z "$cursor" ]; then
    out="$(gh api graphql -f query="$FIRST_PAGE_QUERY" --jq "$EXTRACT")"
  else
    out="$(gh api graphql -f query="$NEXT_PAGE_QUERY" -F cursor="$cursor" \
      --jq "$EXTRACT")"
  fi

  page_ids="$(printf '%s\n' "$out" | grep -v '^__PAGEINFO__' || true)"
  info="$(printf '%s\n' "$out" | grep '^__PAGEINFO__' | tail -1 || true)"
  has_next="$(printf '%s' "$info" | cut -d' ' -f2)"
  cursor="$(printf '%s' "$info" | cut -d' ' -f3)"

  ids="$ids
$page_ids"
done

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

echo "Resolved $count review thread(s) on PR #${PR}."
[ "$count" -eq 0 ] && echo "All threads were already resolved."

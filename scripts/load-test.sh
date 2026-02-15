#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:6001}"
POSTS_PER_USER=10
HASHTAG_POSTS=$((POSTS_PER_USER / 2))

HASHTAG_CAPTIONS=(
  "Beautiful sunset over the mountains #nature #photography"
  "Just finished a great workout #fitness #health"
  "New recipe turned out amazing #cooking #foodie"
  "Exploring the city streets #travel #adventure"
  "Reading a fantastic book today #books #reading"
)

PLAIN_CAPTIONS=(
  "What a wonderful day it is today"
  "Enjoying some quiet time at home"
  "Had the most amazing lunch with friends"
  "Working on a new project this weekend"
  "Just saw an incredible movie at the theater"
)

echo "=== Load Test ==="
echo "Base URL: ${BASE_URL}"
echo ""

echo "Fetching users..."
USERS_JSON=$(curl -sf "${BASE_URL}/api/users")
USER_IDS=$(echo "$USERS_JSON" | python3 -c "import sys,json; [print(u['id']) for u in json.load(sys.stdin)]")
USER_COUNT=$(echo "$USER_IDS" | wc -l | tr -d ' ')
echo "Found ${USER_COUNT} users"
echo ""

TOTAL_POSTS=0
TOTAL_HASHTAG=0
TOTAL_PLAIN=0

for USER_ID in $USER_IDS; do
  echo "User ${USER_ID}: creating ${POSTS_PER_USER} posts..."

  for i in $(seq 1 "$HASHTAG_POSTS"); do
    IDX=$(( (i - 1) % ${#HASHTAG_CAPTIONS[@]} ))
    CAPTION="${HASHTAG_CAPTIONS[$IDX]}"
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/posts" \
      -H 'Content-Type: application/json' \
      -d "{\"userId\": \"${USER_ID}\", \"caption\": \"${CAPTION}\"}")
    if [ "$HTTP_CODE" = "201" ]; then
      TOTAL_HASHTAG=$((TOTAL_HASHTAG + 1))
      TOTAL_POSTS=$((TOTAL_POSTS + 1))
    else
      echo "  WARN: hashtag post ${i} returned HTTP ${HTTP_CODE}"
    fi
  done

  for i in $(seq 1 "$HASHTAG_POSTS"); do
    IDX=$(( (i - 1) % ${#PLAIN_CAPTIONS[@]} ))
    CAPTION="${PLAIN_CAPTIONS[$IDX]}"
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/posts" \
      -H 'Content-Type: application/json' \
      -d "{\"userId\": \"${USER_ID}\", \"caption\": \"${CAPTION}\"}")
    if [ "$HTTP_CODE" = "201" ]; then
      TOTAL_PLAIN=$((TOTAL_PLAIN + 1))
      TOTAL_POSTS=$((TOTAL_POSTS + 1))
    else
      echo "  WARN: plain post ${i} returned HTTP ${HTTP_CODE}"
    fi
  done

  echo "  done (${POSTS_PER_USER} posts)"
done

echo ""
echo "=== Results ==="
echo "Total posts created: ${TOTAL_POSTS}"
echo "  With hashtags:    ${TOTAL_HASHTAG}"
echo "  Without hashtags: ${TOTAL_PLAIN}"
echo ""
echo "Load test complete."


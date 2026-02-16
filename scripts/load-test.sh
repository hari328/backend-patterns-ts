#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:6001}"
DELAY="${2:-0.2}"
POSTS_PER_USER=4

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

FAKE_IDS=(
  "999999999999999999"
  "888888888888888888"
  "777777777777777777"
)

echo "=== Load Test (mixed requests) ==="
echo "Base URL: ${BASE_URL}"
echo "Delay between requests: ${DELAY}s"
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
TOTAL_GET_POST=0
TOTAL_GET_USER_POSTS=0
TOTAL_GET_404=0
CREATED_POST_IDS=()
FAKE_IDX=0
USER_NUM=0

for USER_ID in $USER_IDS; do
  USER_NUM=$((USER_NUM + 1))
  echo "--- User ${USER_NUM}/${USER_COUNT} (${USER_ID}) ---"

  # Create a mix of hashtag and plain posts, interleaved with GETs
  for i in $(seq 1 "$POSTS_PER_USER"); do
    # Alternate hashtag / plain captions
    if [ $((i % 2)) -eq 1 ]; then
      IDX=$(( (i - 1) % ${#HASHTAG_CAPTIONS[@]} ))
      CAPTION="${HASHTAG_CAPTIONS[$IDX]}"
      CAP_TYPE="hashtag"
    else
      IDX=$(( (i - 1) % ${#PLAIN_CAPTIONS[@]} ))
      CAPTION="${PLAIN_CAPTIONS[$IDX]}"
      CAP_TYPE="plain"
    fi

    # POST - create a post
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/posts" \
      -H 'Content-Type: application/json' \
      -d "{\"userId\": \"${USER_ID}\", \"caption\": \"${CAPTION}\"}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" = "201" ]; then
      TOTAL_POSTS=$((TOTAL_POSTS + 1))
      if [ "$CAP_TYPE" = "hashtag" ]; then
        TOTAL_HASHTAG=$((TOTAL_HASHTAG + 1))
      else
        TOTAL_PLAIN=$((TOTAL_PLAIN + 1))
      fi
      POST_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || true)
      if [ -n "$POST_ID" ]; then
        CREATED_POST_IDS+=("$POST_ID")
      fi
      echo "  POST  201  ${CAP_TYPE}"
    else
      echo "  POST  ${HTTP_CODE}  WARN"
    fi
    sleep "$DELAY"

    # GET the post we just created (by ID)
    if [ -n "${POST_ID:-}" ]; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/posts/${POST_ID}")
      if [ "$HTTP_CODE" = "200" ]; then
        TOTAL_GET_POST=$((TOTAL_GET_POST + 1))
      fi
      echo "  GET   ${HTTP_CODE}  /api/posts/${POST_ID}"
      sleep "$DELAY"
    fi

    # Every other post, also GET user posts and throw in a 404
    if [ $((i % 2)) -eq 0 ]; then
      # GET posts by user ID
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/users/${USER_ID}/posts")
      if [ "$HTTP_CODE" = "200" ]; then
        TOTAL_GET_USER_POSTS=$((TOTAL_GET_USER_POSTS + 1))
      fi
      echo "  GET   ${HTTP_CODE}  /api/users/${USER_ID}/posts"
      sleep "$DELAY"

      # GET with a fake ID (404)
      FAKE_ID="${FAKE_IDS[$((FAKE_IDX % ${#FAKE_IDS[@]}))]}"
      FAKE_IDX=$((FAKE_IDX + 1))
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/posts/${FAKE_ID}")
      if [ "$HTTP_CODE" = "404" ]; then
        TOTAL_GET_404=$((TOTAL_GET_404 + 1))
      fi
      echo "  GET   ${HTTP_CODE}  /api/posts/${FAKE_ID} (fake)"
      sleep "$DELAY"
    fi
  done
done

echo ""
echo "=== Results ==="
echo "Posts created:        ${TOTAL_POSTS}"
echo "  With hashtags:      ${TOTAL_HASHTAG}"
echo "  Without hashtags:   ${TOTAL_PLAIN}"
echo "GET post by ID (200): ${TOTAL_GET_POST}"
echo "GET user posts (200): ${TOTAL_GET_USER_POSTS}"
echo "GET 404 responses:    ${TOTAL_GET_404}"
TOTAL_REQUESTS=$((TOTAL_POSTS + TOTAL_GET_POST + TOTAL_GET_USER_POSTS + TOTAL_GET_404))
echo "Total requests:       ${TOTAL_REQUESTS}"
echo ""
echo "Load test complete."

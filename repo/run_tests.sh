#!/bin/bash
# Don't use set -e since we accumulate test failures

BASE_URL="http://localhost:3000/api"
ORG_ID="00000000-0000-0000-0000-000000000001"
ADMIN_USER="admin"
ADMIN_PASS="Admin12345678!"
PASS=0
FAIL=0
TOKEN=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}: $1 - $2"
  FAIL=$((FAIL + 1))
}

# Wait for service health
echo "Waiting for service to be healthy..."
RETRIES=0
MAX_RETRIES=60
until curl -sf "$BASE_URL/health" > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "ERROR: Service did not become healthy after ${MAX_RETRIES} attempts"
    exit 1
  fi
  sleep 3
done
echo "Service is healthy!"

# Helper: make request and capture HTTP code + body
request() {
  local METHOD=$1
  local URL=$2
  local DATA=$3
  local AUTH_HEADER=""

  if [ -n "$TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
  fi

  if [ -n "$DATA" ]; then
    eval curl -s -w "\n%{http_code}" -X "$METHOD" "$URL" \
      -H "Content-Type: application/json" \
      $AUTH_HEADER \
      -d "'$DATA'"
  else
    eval curl -s -w "\n%{http_code}" -X "$METHOD" "$URL" \
      -H "Content-Type: application/json" \
      $AUTH_HEADER
  fi
}

check_status() {
  local RESPONSE="$1"
  local EXPECTED=$2
  local TEST_NAME=$3

  local HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  local BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "$EXPECTED" ]; then
    pass "$TEST_NAME (HTTP $HTTP_CODE)"
  else
    fail "$TEST_NAME" "Expected $EXPECTED, got $HTTP_CODE. Body: $BODY"
  fi
  echo "$BODY"
}

# ==========================================
# TEST: Health Check
# ==========================================
echo ""
echo "=== Health Check ==="
RESP=$(request GET "$BASE_URL/health")
check_status "$RESP" "200" "Health check returns 200" > /dev/null

# ==========================================
# TEST: Auth - Login
# ==========================================
echo ""
echo "=== Authentication ==="
RESP=$(request POST "$BASE_URL/auth/login" "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\",\"organizationId\":\"$ORG_ID\"}")
BODY=$(check_status "$RESP" "200" "Admin login succeeds")
TOKEN=$(echo "$BODY" | jq -r '.token // empty')
if [ -n "$TOKEN" ]; then
  pass "Login returns JWT token"
else
  fail "Login returns JWT token" "No token in response"
fi

# TEST: Login with wrong password
RESP=$(request POST "$BASE_URL/auth/login" "{\"username\":\"$ADMIN_USER\",\"password\":\"WrongPassword1!\",\"organizationId\":\"$ORG_ID\"}")
check_status "$RESP" "401" "Login with wrong password returns 401" > /dev/null

# TEST: Login with short password (validation)
RESP=$(request POST "$BASE_URL/auth/login" "{\"username\":\"$ADMIN_USER\",\"password\":\"short\",\"organizationId\":\"$ORG_ID\"}")
check_status "$RESP" "400" "Login with short password returns 400" > /dev/null

# TEST: Get current user
RESP=$(request GET "$BASE_URL/auth/me")
check_status "$RESP" "200" "Get /auth/me returns 200" > /dev/null

# TEST: Access without token
OLD_TOKEN=$TOKEN
TOKEN=""
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID")
check_status "$RESP" "401" "Request without token returns 401" > /dev/null
TOKEN=$OLD_TOKEN

# ==========================================
# TEST: Organization
# ==========================================
echo ""
echo "=== Organizations ==="
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID")
check_status "$RESP" "200" "Get organization returns 200" > /dev/null

# ==========================================
# TEST: Users
# ==========================================
echo ""
echo "=== Users ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users" "{\"username\":\"testuser1\",\"password\":\"TestPassword123!\"}")
BODY=$(check_status "$RESP" "201" "Create user returns 201")
USER_ID=$(echo "$BODY" | jq -r '.user.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/users")
check_status "$RESP" "200" "List users returns 200" > /dev/null

# Duplicate username
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users" "{\"username\":\"testuser1\",\"password\":\"TestPassword123!\"}")
check_status "$RESP" "409" "Duplicate username returns 409" > /dev/null

# Create a moderator
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users" "{\"username\":\"moduser\",\"password\":\"ModPassword123!\",\"role\":\"moderator\"}")
check_status "$RESP" "201" "Create moderator returns 201" > /dev/null

# ==========================================
# TEST: Forum Sections
# ==========================================
echo ""
echo "=== Sections ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/sections" "{\"name\":\"General Discussion\",\"displayOrder\":1}")
BODY=$(check_status "$RESP" "201" "Create section returns 201")
SECTION_ID=$(echo "$BODY" | jq -r '.section.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/sections?includeSubsections=true")
check_status "$RESP" "200" "List sections returns 200" > /dev/null

# Create subsection
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/sections/$SECTION_ID/subsections" "{\"name\":\"Off-Topic\",\"displayOrder\":1}")
BODY=$(check_status "$RESP" "201" "Create subsection returns 201")
SUBSECTION_ID=$(echo "$BODY" | jq -r '.subsection.id // empty')

# ==========================================
# TEST: Tags
# ==========================================
echo ""
echo "=== Tags ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/tags" "{\"name\":\"Discussion\",\"slug\":\"discussion\",\"category\":\"general\"}")
BODY=$(check_status "$RESP" "201" "Create tag returns 201")
TAG_ID=$(echo "$BODY" | jq -r '.tag.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/tags")
check_status "$RESP" "200" "List tags returns 200" > /dev/null

# Duplicate slug
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/tags" "{\"name\":\"Discussion2\",\"slug\":\"discussion\"}")
check_status "$RESP" "409" "Duplicate tag slug returns 409" > /dev/null

# ==========================================
# TEST: Threads
# ==========================================
echo ""
echo "=== Threads ==="
TAG_IDS_ARR="[]"
if [ -n "$TAG_ID" ]; then
  TAG_IDS_ARR="[\"$TAG_ID\"]"
fi
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads" "{\"subsectionId\":\"$SUBSECTION_ID\",\"title\":\"First Thread\",\"body\":\"This is the body of the first thread.\",\"tagIds\":$TAG_IDS_ARR}")
BODY=$(check_status "$RESP" "201" "Create thread returns 201")
THREAD_ID=$(echo "$BODY" | jq -r '.thread.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/threads?subsectionId=$SUBSECTION_ID")
check_status "$RESP" "200" "List threads returns 200" > /dev/null

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID")
check_status "$RESP" "200" "Get thread detail returns 200" > /dev/null

# Update thread
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID" "{\"title\":\"Updated Thread Title\"}")
check_status "$RESP" "200" "Update thread returns 200" > /dev/null

# ==========================================
# TEST: Thread State
# ==========================================
echo ""
echo "=== Thread State ==="
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isPinned\":true}")
check_status "$RESP" "200" "Pin thread returns 200" > /dev/null

RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isLocked\":true}")
check_status "$RESP" "200" "Lock thread returns 200" > /dev/null

# ==========================================
# TEST: Replies
# ==========================================
echo ""
echo "=== Replies ==="
# Unlock first
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isLocked\":false}")
check_status "$RESP" "200" "Unlock thread returns 200" > /dev/null

RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/replies" "{\"body\":\"This is a reply.\"}")
BODY=$(check_status "$RESP" "201" "Create reply returns 201")
REPLY_ID=$(echo "$BODY" | jq -r '.reply.id // empty')

# Nested reply
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/replies" "{\"body\":\"Nested reply.\",\"parentReplyId\":\"$REPLY_ID\"}")
BODY=$(check_status "$RESP" "201" "Create nested reply returns 201")
REPLY2_ID=$(echo "$BODY" | jq -r '.reply.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/replies")
check_status "$RESP" "200" "List replies returns 200" > /dev/null

# Lock thread and try reply
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isLocked\":true}")
check_status "$RESP" "200" "Lock thread for reply test" > /dev/null

RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/replies" "{\"body\":\"Should fail.\"}")
check_status "$RESP" "403" "Reply to locked thread returns 403" > /dev/null

# Unlock for further tests
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isLocked\":false}")

# Archive thread and try edit
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isArchived\":true}")
check_status "$RESP" "200" "Archive thread returns 200" > /dev/null

RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID" "{\"title\":\"Should fail archived\"}")
check_status "$RESP" "403" "Edit archived thread returns 403" > /dev/null

# Un-archive for further tests
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/state" "{\"isArchived\":false}")
check_status "$RESP" "200" "Un-archive thread" > /dev/null

# ==========================================
# TEST: Reports
# ==========================================
echo ""
echo "=== Reports ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads/$THREAD_ID/reports" "{\"reason\":\"Spam content\"}")
check_status "$RESP" "201" "Create report returns 201" > /dev/null

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/reports")
check_status "$RESP" "200" "List reports returns 200" > /dev/null

# ==========================================
# TEST: Announcements
# ==========================================
echo ""
echo "=== Announcements ==="
FUTURE=$(date -u -d "+30 days" +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v+30d +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo "2027-12-31T23:59:59.000Z")
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo "2026-01-01T00:00:00.000Z")
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/announcements" "{\"title\":\"Test Announcement\",\"body\":\"Important news.\",\"displayOrder\":1,\"startDate\":\"$NOW\",\"endDate\":\"$FUTURE\"}")
BODY=$(check_status "$RESP" "201" "Create announcement returns 201")
ANN_ID=$(echo "$BODY" | jq -r '.announcement.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/announcements")
check_status "$RESP" "200" "List announcements returns 200" > /dev/null

# ==========================================
# TEST: Carousel
# ==========================================
echo ""
echo "=== Carousel ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/carousel" "{\"title\":\"Carousel Item\",\"displayOrder\":1,\"startDate\":\"$NOW\",\"endDate\":\"$FUTURE\"}")
check_status "$RESP" "201" "Create carousel item returns 201" > /dev/null

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/carousel")
check_status "$RESP" "200" "List carousel items returns 200" > /dev/null

# ==========================================
# TEST: Venues & Bookings
# ==========================================
echo ""
echo "=== Venues & Bookings ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/venues" "{\"name\":\"Conference Room A\",\"capacity\":50}")
BODY=$(check_status "$RESP" "201" "Create venue returns 201")
VENUE_ID=$(echo "$BODY" | jq -r '.venue.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/venues")
check_status "$RESP" "200" "List venues returns 200" > /dev/null

# Create booking
BOOKING_START="2027-06-15T10:00:00.000Z"
BOOKING_END="2027-06-15T12:00:00.000Z"
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/venues/$VENUE_ID/bookings" "{\"title\":\"Team Meeting\",\"startTime\":\"$BOOKING_START\",\"endTime\":\"$BOOKING_END\"}")
check_status "$RESP" "201" "Create booking returns 201" > /dev/null

# Overlapping booking
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/venues/$VENUE_ID/bookings" "{\"title\":\"Overlap\",\"startTime\":\"2027-06-15T11:00:00.000Z\",\"endTime\":\"2027-06-15T13:00:00.000Z\"}")
check_status "$RESP" "409" "Overlapping booking returns 409" > /dev/null

# ==========================================
# TEST: Notifications
# ==========================================
echo ""
echo "=== Notifications ==="
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/notifications")
check_status "$RESP" "200" "List notifications returns 200" > /dev/null

# ==========================================
# TEST: Subscriptions
# ==========================================
echo ""
echo "=== Subscriptions ==="
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/subscriptions" "{\"category\":\"general\",\"isSubscribed\":true}")
check_status "$RESP" "200" "Update subscription returns 200" > /dev/null

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/subscriptions")
check_status "$RESP" "200" "List subscriptions returns 200" > /dev/null

# ==========================================
# TEST: Audit Logs
# ==========================================
echo ""
echo "=== Audit Logs ==="
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/audit-logs")
check_status "$RESP" "200" "List audit logs returns 200" > /dev/null

# ==========================================
# TEST: Analytics
# ==========================================
echo ""
echo "=== Analytics ==="
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/analytics/funnel")
check_status "$RESP" "200" "Get funnel metrics returns 200" > /dev/null

# ==========================================
# TEST: Anomalies
# ==========================================
echo ""
echo "=== Anomalies ==="
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/anomalies")
check_status "$RESP" "200" "List anomalies returns 200" > /dev/null

# ==========================================
# TEST: Feature Flags
# ==========================================
echo ""
echo "=== Feature Flags ==="
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/feature-flags" "{\"key\":\"dark_mode\",\"value\":{\"enabled\":true},\"description\":\"Dark mode toggle\"}")
BODY=$(check_status "$RESP" "201" "Create feature flag returns 201")
FLAG_ID=$(echo "$BODY" | jq -r '.flag.id // empty')

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/feature-flags")
check_status "$RESP" "200" "List feature flags returns 200" > /dev/null

# Duplicate key
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/feature-flags" "{\"key\":\"dark_mode\",\"value\":{\"enabled\":false}}")
check_status "$RESP" "409" "Duplicate feature flag key returns 409" > /dev/null

# ==========================================
# TEST: Moderation - Bulk Action
# ==========================================
echo ""
echo "=== Moderation ==="
# Create a thread to bulk-delete
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads" "{\"subsectionId\":\"$SUBSECTION_ID\",\"title\":\"Thread to delete\",\"body\":\"Will be bulk deleted.\"}")
BODY=$(echo "$RESP" | sed '$d')
BULK_THREAD_ID=$(echo "$BODY" | jq -r '.thread.id // empty')

if [ -n "$BULK_THREAD_ID" ]; then
  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/moderation/bulk-action" "{\"action\":\"delete\",\"resourceType\":\"thread\",\"resourceIds\":[\"$BULK_THREAD_ID\"]}")
  check_status "$RESP" "200" "Bulk delete returns 200" > /dev/null
fi

# Recycle bin
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/recycle-bin")
check_status "$RESP" "200" "List recycle bin returns 200" > /dev/null

# ==========================================
# TEST: Password Change
# ==========================================
echo ""
echo "=== Password Change ==="
RESP=$(request PUT "$BASE_URL/auth/password" "{\"currentPassword\":\"$ADMIN_PASS\",\"newPassword\":\"NewAdmin12345678!\"}")
check_status "$RESP" "200" "Change password returns 200" > /dev/null

# Login with new password
RESP=$(request POST "$BASE_URL/auth/login" "{\"username\":\"$ADMIN_USER\",\"password\":\"NewAdmin12345678!\",\"organizationId\":\"$ORG_ID\"}")
BODY=$(check_status "$RESP" "200" "Login with new password succeeds")
TOKEN=$(echo "$BODY" | jq -r '.token // empty')

# Change back
RESP=$(request PUT "$BASE_URL/auth/password" "{\"currentPassword\":\"NewAdmin12345678!\",\"newPassword\":\"$ADMIN_PASS\"}")
check_status "$RESP" "200" "Change password back returns 200" > /dev/null

# ==========================================
# TEST: 404 for unknown route
# ==========================================
echo ""
echo "=== Edge Cases ==="
RESP=$(request GET "$BASE_URL/nonexistent")
check_status "$RESP" "404" "Unknown route returns 404" > /dev/null

# Non-existent resource
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/threads/00000000-0000-0000-0000-000000000099")
check_status "$RESP" "404" "Non-existent thread returns 404" > /dev/null

# Access wrong org
RESP=$(request GET "$BASE_URL/organizations/00000000-0000-0000-0000-999999999999")
check_status "$RESP" "403" "Wrong organization returns 403" > /dev/null

# ==========================================
# TEST: User Ban/Mute
# ==========================================
echo ""
echo "=== Ban/Mute ==="
if [ -n "$USER_ID" ]; then
  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users/$USER_ID/mute" "{\"durationHours\":24,\"reason\":\"Testing mute\"}")
  check_status "$RESP" "200" "Mute user returns 200" > /dev/null

  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users/$USER_ID/unmute")
  check_status "$RESP" "200" "Unmute user returns 200" > /dev/null

  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users/$USER_ID/ban" "{\"reason\":\"Testing ban\"}")
  check_status "$RESP" "200" "Ban user returns 200" > /dev/null

  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/users/$USER_ID/unban")
  check_status "$RESP" "200" "Unban user returns 200" > /dev/null
fi

# ==========================================
# TEST: Logout
# ==========================================
echo ""
echo "=== Logout ==="
RESP=$(request POST "$BASE_URL/auth/logout")
check_status "$RESP" "200" "Logout returns 200" > /dev/null

# ==========================================
# RESULTS
# ==========================================
echo ""
echo "========================================="
echo "  Test Results: $PASS passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0

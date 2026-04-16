#!/bin/bash
# API test suite - exercises all HTTP endpoints against the running service
# Invoked by run_tests.sh after the service health check passes
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
  echo -e "${GREEN}PASS${NC}: $1" >&2
  PASS=$((PASS + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}: $1 - $2" >&2
  FAIL=$((FAIL + 1))
}

# Helper: make request and capture HTTP code + body
request() {
  local METHOD="$1"
  local URL="$2"
  local DATA="$3"

  local args=(-s -w $'\n%{http_code}' -X "$METHOD" "$URL" -H "Content-Type: application/json")

  if [ -n "$TOKEN" ]; then
    args+=(-H "Authorization: Bearer $TOKEN")
  fi

  if [ -n "$DATA" ]; then
    args+=(-d "$DATA")
  fi

  curl "${args[@]}"
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

# Deep contract helpers — validate response body fields via jq
check_json() {
  local BODY="$1"
  local JQ_EXPR="$2"
  local EXPECTED="$3"
  local TEST_NAME="$4"

  local ACTUAL=$(echo "$BODY" | jq -r "$JQ_EXPR // empty" 2>/dev/null)
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    pass "$TEST_NAME"
  else
    fail "$TEST_NAME" "Expected '$EXPECTED', got '$ACTUAL'"
  fi
}

check_json_exists() {
  local BODY="$1"
  local JQ_EXPR="$2"
  local TEST_NAME="$3"

  local ACTUAL=$(echo "$BODY" | jq -r "$JQ_EXPR // empty" 2>/dev/null)
  if [ -n "$ACTUAL" ]; then
    pass "$TEST_NAME"
  else
    fail "$TEST_NAME" "Field $JQ_EXPR is empty or missing"
  fi
}

check_json_absent() {
  local BODY="$1"
  local JQ_EXPR="$2"
  local TEST_NAME="$3"

  local ACTUAL=$(echo "$BODY" | jq -r "$JQ_EXPR // empty" 2>/dev/null)
  if [ -z "$ACTUAL" ]; then
    pass "$TEST_NAME"
  else
    fail "$TEST_NAME" "Field $JQ_EXPR should not exist but has value: $ACTUAL"
  fi
}

# ==========================================
# TEST: Health Check
# ==========================================
echo ""
echo "=== Health Check ==="
RESP=$(request GET "$BASE_URL/health")
BODY=$(check_status "$RESP" "200" "Health check returns 200")
check_json "$BODY" '.status' 'ok' "Health response status is ok"
check_json_exists "$BODY" '.timestamp' "Health response has timestamp"
check_json_exists "$BODY" '.version' "Health response has version"

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
check_json "$BODY" '.user.role' 'admin' "Login user role is admin"
check_json "$BODY" '.user.username' 'admin' "Login user username is admin"
check_json_exists "$BODY" '.user.id' "Login user has id"
check_json_absent "$BODY" '.user.passwordHash' "Login response has no passwordHash"

# TEST: Login with wrong password
RESP=$(request POST "$BASE_URL/auth/login" "{\"username\":\"$ADMIN_USER\",\"password\":\"WrongPassword1!\",\"organizationId\":\"$ORG_ID\"}")
BODY=$(check_status "$RESP" "401" "Login with wrong password returns 401")
check_json "$BODY" '.error.code' 'UNAUTHORIZED' "401 error code is UNAUTHORIZED"

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
check_json_exists "$BODY" '.user.id' "Created user has id"
check_json "$BODY" '.user.username' 'testuser1' "Created user username matches"
check_json_absent "$BODY" '.user.passwordHash' "Created user has no passwordHash"

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/users")
BODY=$(check_status "$RESP" "200" "List users returns 200")
check_json_exists "$BODY" '.total' "List users has total count"
check_json_exists "$BODY" '.data' "List users has data array"

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
check_json "$BODY" '.thread.title' 'First Thread' "Created thread title matches"
check_json_exists "$BODY" '.thread.authorId' "Created thread has authorId"

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
BODY=$(check_status "$RESP" "201" "Create carousel item returns 201")
CAROUSEL_ID=$(echo "$BODY" | jq -r '.item.id // empty')

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
BODY=$(check_status "$RESP" "201" "Create booking returns 201")
BOOKING_ID=$(echo "$BODY" | jq -r '.booking.id // empty')

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
# TEST: Organizations - Extended
# ==========================================
echo ""
echo "=== Organizations Extended ==="

RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID" "{\"name\":\"Updated Org Name\"}")
check_status "$RESP" "200" "Update organization returns 200" > /dev/null

NEW_ORG_SLUG="test-new-org-$(date +%s)"
RESP=$(request POST "$BASE_URL/organizations" "{\"name\":\"Test New Org\",\"slug\":\"$NEW_ORG_SLUG\"}")
check_status "$RESP" "201" "Create organization (platform admin) returns 201" > /dev/null

# ==========================================
# TEST: Sections - Extended
# ==========================================
echo ""
echo "=== Sections Extended ==="

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/sections/$SECTION_ID")
check_status "$RESP" "200" "Get section by ID returns 200" > /dev/null

RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/sections/$SECTION_ID" "{\"name\":\"General Discussion Updated\"}")
check_status "$RESP" "200" "Update section returns 200" > /dev/null

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/sections/$SECTION_ID/subsections")
check_status "$RESP" "200" "List subsections for section returns 200" > /dev/null

RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/subsections/$SUBSECTION_ID" "{\"name\":\"Off-Topic Updated\"}")
check_status "$RESP" "200" "Update subsection returns 200" > /dev/null

# Create and delete a temp section
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/sections" "{\"name\":\"Temp Section\",\"displayOrder\":99}")
BODY=$(echo "$RESP" | sed '$d')
TEMP_SECTION_ID=$(echo "$BODY" | jq -r '.section.id // empty')
if [ -n "$TEMP_SECTION_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/sections/$TEMP_SECTION_ID")
  check_status "$RESP" "204" "Delete section returns 204" > /dev/null
fi

# Create and delete a temp subsection
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/sections/$SECTION_ID/subsections" "{\"name\":\"Temp Subsection\",\"displayOrder\":99}")
BODY=$(echo "$RESP" | sed '$d')
TEMP_SUB_ID=$(echo "$BODY" | jq -r '.subsection.id // empty')
if [ -n "$TEMP_SUB_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/subsections/$TEMP_SUB_ID")
  check_status "$RESP" "204" "Delete subsection returns 204" > /dev/null
fi

# ==========================================
# TEST: Tags - Extended
# ==========================================
echo ""
echo "=== Tags Extended ==="

if [ -n "$TAG_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/tags/$TAG_ID" "{\"name\":\"Discussion Updated\"}")
  check_status "$RESP" "200" "Update tag returns 200" > /dev/null
fi

# Create and delete a temp tag
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/tags" "{\"name\":\"TempTag\",\"slug\":\"temp-tag\",\"category\":\"general\"}")
BODY=$(echo "$RESP" | sed '$d')
TEMP_TAG_ID=$(echo "$BODY" | jq -r '.tag.id // empty')
if [ -n "$TEMP_TAG_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/tags/$TEMP_TAG_ID")
  check_status "$RESP" "204" "Delete tag returns 204" > /dev/null
fi

# ==========================================
# TEST: Threads - Extended (delete)
# ==========================================
echo ""
echo "=== Threads Extended ==="

RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/threads" "{\"subsectionId\":\"$SUBSECTION_ID\",\"title\":\"Thread To Delete\",\"body\":\"This thread will be deleted.\"}")
BODY=$(echo "$RESP" | sed '$d')
THREAD2_ID=$(echo "$BODY" | jq -r '.thread.id // empty')
if [ -n "$THREAD2_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/threads/$THREAD2_ID")
  check_status "$RESP" "204" "Delete thread returns 204" > /dev/null
fi

# ==========================================
# TEST: Replies - Extended
# ==========================================
echo ""
echo "=== Replies Extended ==="

if [ -n "$REPLY_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/replies/$REPLY_ID" "{\"body\":\"Updated reply body.\"}")
  check_status "$RESP" "200" "Update reply returns 200" > /dev/null
fi

if [ -n "$REPLY2_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/replies/$REPLY2_ID")
  check_status "$RESP" "204" "Delete reply returns 204" > /dev/null
fi

# ==========================================
# TEST: Reports - Extended
# ==========================================
echo ""
echo "=== Reports Extended ==="

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/reports")
REPORT_ID=$(echo "$RESP" | sed '$d' | jq -r '.data[0].id // empty')
if [ -n "$REPORT_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/reports/$REPORT_ID" "{\"status\":\"reviewed\"}")
  check_status "$RESP" "200" "Update report status returns 200" > /dev/null
fi

# ==========================================
# TEST: Users - Extended
# ==========================================
echo ""
echo "=== Users Extended ==="

if [ -n "$USER_ID" ]; then
  RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/users/$USER_ID")
  check_status "$RESP" "200" "Get user by ID returns 200" > /dev/null

  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/users/$USER_ID/role" "{\"role\":\"moderator\"}")
  check_status "$RESP" "200" "Update user role to moderator returns 200" > /dev/null

  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/users/$USER_ID/role" "{\"role\":\"user\"}")
  check_status "$RESP" "200" "Reset user role to user returns 200" > /dev/null
fi

# ==========================================
# TEST: Announcements - Extended
# ==========================================
echo ""
echo "=== Announcements Extended ==="

if [ -n "$ANN_ID" ]; then
  RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/announcements/$ANN_ID")
  check_status "$RESP" "200" "Get announcement by ID returns 200" > /dev/null

  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/announcements/$ANN_ID" "{\"title\":\"Updated Announcement\"}")
  check_status "$RESP" "200" "Update announcement returns 200" > /dev/null
fi

# Create and delete a temp announcement
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/announcements" "{\"title\":\"Temp Announcement\",\"body\":\"To be deleted.\",\"displayOrder\":2,\"startDate\":\"$NOW\",\"endDate\":\"$FUTURE\"}")
BODY=$(echo "$RESP" | sed '$d')
ANN2_ID=$(echo "$BODY" | jq -r '.announcement.id // empty')
if [ -n "$ANN2_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/announcements/$ANN2_ID")
  check_status "$RESP" "204" "Delete announcement returns 204" > /dev/null
fi

# ==========================================
# TEST: Carousel - Extended
# ==========================================
echo ""
echo "=== Carousel Extended ==="

if [ -n "$CAROUSEL_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/carousel/$CAROUSEL_ID" "{\"title\":\"Updated Carousel Item\"}")
  check_status "$RESP" "200" "Update carousel item returns 200" > /dev/null
fi

# Create and delete a temp carousel item
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/carousel" "{\"title\":\"Temp Carousel\",\"displayOrder\":2,\"startDate\":\"$NOW\",\"endDate\":\"$FUTURE\"}")
BODY=$(echo "$RESP" | sed '$d')
CAROUSEL2_ID=$(echo "$BODY" | jq -r '.item.id // empty')
if [ -n "$CAROUSEL2_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/carousel/$CAROUSEL2_ID")
  check_status "$RESP" "204" "Delete carousel item returns 204" > /dev/null
fi

# ==========================================
# TEST: Venues - Extended
# ==========================================
echo ""
echo "=== Venues Extended ==="

if [ -n "$VENUE_ID" ]; then
  RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/venues/$VENUE_ID")
  check_status "$RESP" "200" "Get venue by ID returns 200" > /dev/null

  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/venues/$VENUE_ID" "{\"name\":\"Conference Room A Updated\",\"capacity\":75}")
  check_status "$RESP" "200" "Update venue returns 200" > /dev/null

  RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/venues/$VENUE_ID/bookings")
  check_status "$RESP" "200" "List venue bookings returns 200" > /dev/null
fi

# Create and delete a temp venue
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/venues" "{\"name\":\"Temp Room\",\"capacity\":10}")
BODY=$(echo "$RESP" | sed '$d')
VENUE2_ID=$(echo "$BODY" | jq -r '.venue.id // empty')
if [ -n "$VENUE2_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/venues/$VENUE2_ID")
  check_status "$RESP" "204" "Delete venue returns 204" > /dev/null
fi

# ==========================================
# TEST: Bookings - Extended
# ==========================================
echo ""
echo "=== Bookings Extended ==="

if [ -n "$BOOKING_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/bookings/$BOOKING_ID" "{\"title\":\"Updated Team Meeting\"}")
  check_status "$RESP" "200" "Update booking returns 200" > /dev/null
fi

# Create and cancel a second booking
if [ -n "$VENUE_ID" ]; then
  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/venues/$VENUE_ID/bookings" "{\"title\":\"Temp Meeting\",\"startTime\":\"2027-07-15T10:00:00.000Z\",\"endTime\":\"2027-07-15T12:00:00.000Z\"}")
  BODY=$(echo "$RESP" | sed '$d')
  BOOKING2_ID=$(echo "$BODY" | jq -r '.booking.id // empty')
  if [ -n "$BOOKING2_ID" ]; then
    RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/bookings/$BOOKING2_ID")
    check_status "$RESP" "204" "Cancel booking returns 204" > /dev/null
  fi
fi

# ==========================================
# TEST: Notifications - Extended
# ==========================================
echo ""
echo "=== Notifications Extended ==="

RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/notifications/read-all")
check_status "$RESP" "200" "Mark all notifications read returns 200" > /dev/null

# Subscribe to announcement to trigger a notification
RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/subscriptions" "{\"category\":\"announcement\",\"isSubscribed\":true}")
check_status "$RESP" "200" "Subscribe to announcement category returns 200" > /dev/null

# Create announcement to trigger notification for subscribed admin
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/announcements" "{\"title\":\"Notification Trigger\",\"body\":\"Creates a notification.\",\"displayOrder\":3,\"startDate\":\"$NOW\",\"endDate\":\"$FUTURE\"}")
check_status "$RESP" "201" "Create announcement for notification trigger returns 201" > /dev/null

# Get a notification ID to mark as read
RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/notifications")
NOTIF_ID=$(echo "$RESP" | sed '$d' | jq -r '.data[0].id // empty')
if [ -n "$NOTIF_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/notifications/$NOTIF_ID/read")
  check_status "$RESP" "200" "Mark notification as read returns 200" > /dev/null
fi

# ==========================================
# TEST: Anomalies - Extended (conditional)
# ==========================================
echo ""
echo "=== Anomalies Extended ==="

RESP=$(request GET "$BASE_URL/organizations/$ORG_ID/anomalies")
ANOMALY_ID=$(echo "$RESP" | sed '$d' | jq -r '.data[0].id // empty')
if [ -n "$ANOMALY_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/anomalies/$ANOMALY_ID" "{\"status\":\"acknowledged\"}")
  check_status "$RESP" "200" "Update anomaly status returns 200" > /dev/null
else
  pass "Anomaly update skipped (no anomalies present)"
fi

# ==========================================
# TEST: Feature Flags - Extended
# ==========================================
echo ""
echo "=== Feature Flags Extended ==="

if [ -n "$FLAG_ID" ]; then
  RESP=$(request PUT "$BASE_URL/organizations/$ORG_ID/feature-flags/$FLAG_ID" "{\"value\":{\"enabled\":false},\"description\":\"Updated flag\"}")
  check_status "$RESP" "200" "Update feature flag returns 200" > /dev/null
fi

# Create and delete a temp feature flag
RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/feature-flags" "{\"key\":\"temp_flag\",\"value\":{\"enabled\":true},\"description\":\"Temp flag\"}")
BODY=$(echo "$RESP" | sed '$d')
FLAG2_ID=$(echo "$BODY" | jq -r '.flag.id // empty')
if [ -n "$FLAG2_ID" ]; then
  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/feature-flags/$FLAG2_ID")
  check_status "$RESP" "204" "Delete feature flag returns 204" > /dev/null
fi

# ==========================================
# TEST: Recycle Bin - Restore and Permanent Delete
# ==========================================
echo ""
echo "=== Recycle Bin Extended ==="

if [ -n "$BULK_THREAD_ID" ]; then
  RESP=$(request POST "$BASE_URL/organizations/$ORG_ID/recycle-bin/thread/$BULK_THREAD_ID/restore")
  check_status "$RESP" "200" "Restore thread from recycle bin returns 200" > /dev/null

  RESP=$(request DELETE "$BASE_URL/organizations/$ORG_ID/recycle-bin/thread/$BULK_THREAD_ID")
  check_status "$RESP" "204" "Permanent delete from recycle bin returns 204" > /dev/null
fi

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
BODY=$(check_status "$RESP" "404" "Non-existent thread returns 404")
check_json "$BODY" '.error.code' 'NOT_FOUND' "404 error code is NOT_FOUND"
check_json_exists "$BODY" '.error.message' "404 error has message"

# Access wrong org
RESP=$(request GET "$BASE_URL/organizations/00000000-0000-0000-0000-999999999999")
BODY=$(check_status "$RESP" "403" "Wrong organization returns 403")
check_json_exists "$BODY" '.error.code' "403 error has code"

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

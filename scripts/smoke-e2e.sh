#!/usr/bin/env bash
# HTTP smoke of the Sprint-1 slice against a running API (local demo; sandbox payments only).
# Usage: API=http://127.0.0.1:PORT ADMIN_EMAIL=admin@admin.com ADMIN_PASSWORD=... scripts/smoke-e2e.sh
set -euo pipefail
API=${API:?}
j() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
post() { curl -sf -X POST "$API$1" -H "Content-Type: application/json" ${3:+-H "Authorization: Bearer $3"} -d "$2"; }
get() { curl -sf "$API$1" -H "Authorization: Bearer $2"; }
run=$(date +%s)
ADMIN=$(post /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | j "['access_token']")
STAFF_ID=$(post /admin/staff "{\"email\":\"staff$run@test.com\",\"password\":\"staff-pass-123\",\"full_name\":\"Demo Staff\",\"display_name\":\"Demo\"}" "$ADMIN" | j "['id']")
OFF=$(post /admin/offerings '{"name":"Demo (no es precio real)","duration_minutes":120,"price_minor":10000,"staff_earning_minor":4000}' "$ADMIN" | j "['id']")
CUST=$(post /auth/register "{\"email\":\"cust$run@test.com\",\"password\":\"cust-pass-123\",\"full_name\":\"Cliente Demo\"}" | j "['access_token']")
STAFF=$(post /auth/login "{\"email\":\"staff$run@test.com\",\"password\":\"staff-pass-123\"}" | j "['access_token']")
DAY=$(python3 -c "
from datetime import date,timedelta
d=date.today()+timedelta(days=3)
while d.weekday()>4: d+=timedelta(days=1)
print(d)")
SLOT=$(get "/staff/$STAFF_ID/availability?offering_id=$OFF&day=$DAY" "$CUST" | j "['slots'][0]['starts_at']")
BID=$(post /bookings "{\"staff_id\":$STAFF_ID,\"offering_id\":$OFF,\"starts_at\":\"$SLOT\",\"address\":\"Calle Demo 1, Veracruz\"}" "$CUST" | j "['id']")
PID=$(post "/bookings/$BID/checkout" '{}' "$CUST" | j "['id']")
echo "payment:   $(post "/payments/$PID/sandbox-outcome" '{}' "$CUST" | j "['status']")"
echo "admin sees booking: $(get /bookings "$ADMIN" | python3 -c "import sys,json;print(any(b['id']==$BID for b in json.load(sys.stdin)))")"
echo "staff sees: $(get "/bookings/$BID" "$STAFF" | j "['status']")"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
post "/bookings/$BID/check-in" "{\"capture_status\":\"permission_denied\",\"occurred_at\":\"$NOW\"}" "$STAFF" >/dev/null
post "/bookings/$BID/check-out" "{\"capture_status\":\"captured\",\"occurred_at\":\"$NOW\",\"latitude\":19.18,\"longitude\":-96.14,\"accuracy_m\":15}" "$STAFF" >/dev/null
echo "after check-out (GPS denied at check-in): $(get "/bookings/$BID" "$STAFF" | j "['status']")"
EXC=$(get /admin/attendance-exceptions "$ADMIN" | python3 -c "import sys,json;print([e['id'] for e in json.load(sys.stdin) if e['booking_id']==$BID][0])")
post "/admin/attendance-exceptions/$EXC/resolve" '{"approve":true,"note":"Verificado por llamada"}' "$ADMIN" >/dev/null
echo "after admin approval: $(get "/bookings/$BID" "$STAFF" | j "['status']")"
WEEK=$(python3 -c "from datetime import date,timedelta;d=date.fromisoformat('$DAY');print(d-timedelta(days=d.weekday()))")
echo "staff earnings week $WEEK: $(get "/me/earnings?week_start=$WEEK" "$STAFF" | python3 -c "import sys,json;d=json.load(sys.stdin);print('earned', d['earned_minor'], 'approved', d['approved_minor'], 'paid', d['paid_minor'])")"

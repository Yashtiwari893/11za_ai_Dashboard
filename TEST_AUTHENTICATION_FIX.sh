#!/bin/bash
# AUTHENTICATION BUG FIX - VERIFICATION SCRIPT
# Quick testing to confirm security fix is working

echo "🔐 AUTHENTICATION SECURITY TEST SUITE"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"

echo "ℹ️  Testing against: $BASE_URL"
echo ""

# Test 1: Unauthenticated access to /admin
echo "TEST 1: Unauthenticated access to /admin"
echo "Expected: Redirect to /login"
echo "Command:"
echo "curl -i -L $BASE_URL/admin"
echo ""
read -p "Press ENTER after testing..."
echo ""

# Test 2: Unauthenticated access to /super-admin
echo "TEST 2: Unauthenticated access to /super-admin"
echo "Expected: Redirect to /login"
echo "Command:"
echo "curl -i -L $BASE_URL/super-admin"
echo ""
read -p "Press ENTER after testing..."
echo ""

# Test 3: Unauthenticated access to /user
echo "TEST 3: Unauthenticated access to /user"
echo "Expected: Redirect to /login"
echo "Command:"
echo "curl -i -L $BASE_URL/user"
echo ""
read -p "Press ENTER after testing..."
echo ""

echo "✅ MANUAL TESTS (Use browser):"
echo "================================"
echo ""
echo "1. INCOGNITO BROWSER TEST"
echo "   - Open new incognito window"
echo "   - Try: $BASE_URL/admin"
echo "   - Should redirect to /login"
echo "   - Result: [ ] PASS [ ] FAIL"
echo ""

echo "2. WRONG ROLE TEST"
echo "   - Login as regular 'user'"
echo "   - Try to visit: $BASE_URL/admin"
echo "   - Should redirect to /user"
echo "   - Result: [ ] PASS [ ] FAIL"
echo ""

echo "3. CORRECT ROLE TEST"
echo "   - Login as 'admin'"
echo "   - Visit: $BASE_URL/admin"
echo "   - Should show admin dashboard"
echo "   - Result: [ ] PASS [ ] FAIL"
echo ""

echo "4. SESSION PERSISTENCE TEST"
echo "   - Login to dashboard"
echo "   - Press F5 (refresh)"
echo "   - Should stay logged in"
echo "   - Result: [ ] PASS [ ] FAIL"
echo ""

echo "5. LOGOUT TEST"
echo "   - Click logout"
echo "   - Try browser back button"
echo "   - Should NOT access dashboard"
echo "   - Result: [ ] PASS [ ] FAIL"
echo ""

echo "6. NEW TAB TEST"
echo "   - Login in Tab 1"
echo "   - Open new tab (Tab 2)"
echo "   - Try accessing /admin in Tab 2"
echo "   - Should redirect to /login"
echo "   - Result: [ ] PASS [ ] FAIL"
echo ""

echo "=========================================="
echo "✅ ALL TESTS PASSED? If YES, fix is working!"
echo "❌ FAILED? Check console errors in DevTools"
echo "=========================================="

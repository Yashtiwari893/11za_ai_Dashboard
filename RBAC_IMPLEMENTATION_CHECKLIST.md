# RBAC Implementation Checklist for Developers

## Pre-Implementation Setup

### Environment & Dependencies
- [ ] Node.js 16+ installed
- [ ] npm or pnpm available
- [ ] Supabase project created
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configured
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- [ ] Next.js 16+ (Turbopack) installed
- [ ] TypeScript configured

---

## Step 1: Database Setup (Estimated: 5 minutes)

### Run the RBAC Migration
- [ ] Open Supabase SQL Editor
- [ ] Copy content from `migrations/add_rbac_schema.sql`
- [ ] Paste into SQL Editor
- [ ] Click "RUN" to execute
- [ ] Verify: Check "user_profiles" table exists
- [ ] Verify: Check "user_audit_log" table exists
- [ ] Verify: Check RLS policies are enabled

### Verify Schema
```sql
-- Run these to confirm setup:
SELECT * FROM user_roles;           -- Should show 2 rows
SELECT * FROM user_profiles LIMIT 1; -- Should show columns
SELECT * FROM user_audit_log LIMIT 1; -- Should be empty
```

- [ ] All tables created successfully
- [ ] No SQL errors

---

## Step 2: Code Files Review

### Backend Authorization (3 files)
- [ ] `src/lib/auth/rbac.ts` exists
  - [ ] Contains `getAuthContext()`
  - [ ] Contains `requireAuth()`
  - [ ] Contains `requireAdmin()`
  - [ ] Contains `logAuditTrail()`

- [ ] `src/lib/auth/navigation.ts` exists
  - [ ] Contains `getDashboardPath()`
  - [ ] Contains `getRedirectPath()`

### API Endpoints (4 route files)
- [ ] `src/app/api/admin/users/route.ts` (GET all users)
- [ ] `src/app/api/admin/users/[userId]/route.ts` (GET/POST single user)
- [ ] `src/app/api/admin/stats/route.ts` (GET system stats)
- [ ] `src/app/api/user/profile/route.ts` (GET/POST own profile)

### Frontend Pages (3 files)
- [ ] `src/app/admin/page.tsx` (Admin Dashboard)
- [ ] `src/app/user/page.tsx` (User Dashboard)
- [ ] `src/app/(auth)/login/page.tsx` (Updated login with role redirect)

### Middleware
- [ ] `middleware.ts` updated with `/admin` and `/user` routes

### Documentation
- [ ] `RBAC_DOCUMENTATION.md` (Complete docs)
- [ ] `RBAC_QUICK_START.md` (Quick start guide)
- [ ] `RBAC_IMPLEMENTATION_COMPLETE.md` (Implementation summary)

---

## Step 3: Initial User Setup (Estimated: 10 minutes)

### Create Initial Admin User
```bash
# Use Supabase Auth UI or API to create a test admin account
# Email: admin@test.com
# Password: SecurePassword123!
```

- [ ] Admin user created in Supabase auth
- [ ] Navigate to SQL Editor

### Register Admin in user_profiles
```sql
-- Insert the admin user into user_profiles
INSERT INTO user_profiles (id, email, full_name, role, is_active, is_verified_email)
SELECT 
  id,
  email,
  'Test Admin',
  'admin',
  true,
  true
FROM auth.users
WHERE email = 'admin@test.com'
AND id NOT IN (SELECT id FROM user_profiles);

-- Verify
SELECT * FROM user_profiles WHERE email = 'admin@test.com';
```

- [ ] Admin user inserted
- [ ] Role is 'admin'
- [ ] is_active is true

### Create Regular User
```bash
# Create another test user via Supabase Auth
# Email: user@test.com
# Password: TestPassword123!
```

- [ ] Regular user created in Supabase auth

### Register Regular User in user_profiles
```sql
-- Insert the user into user_profiles
INSERT INTO user_profiles (id, email, full_name, role, is_active, is_verified_email)
SELECT 
  id,
  email,
  'Test User',
  'user',
  true,
  true
FROM auth.users
WHERE email = 'user@test.com'
AND id NOT IN (SELECT id FROM user_profiles);

-- Verify
SELECT * FROM user_profiles WHERE email = 'user@test.com';
```

- [ ] Regular user inserted
- [ ] Role is 'user'
- [ ] is_active is true

---

## Step 4: Local Development Testing (Estimated: 20 minutes)

### Start Dev Server
```bash
npm run dev
# or
pnpm dev
```

- [ ] Server starts without errors
- [ ] Port 3000 accessible
- [ ] No console errors

### Test Admin Login & Redirect
1. Open `http://localhost:3000/login`
2. Login with admin@test.com / SecurePassword123!
3. Wait for redirect
4. Verify: You're on `/admin` (not `/user` or `/dashboard`)

- [ ] Admin redirected to `/admin` ✅
- [ ] Page loads without console errors
- [ ] User list appears with data

### Test Admin Dashboard Features
1. On `/admin` page:
2. Click "Previous" / "Next" pagination buttons
3. Try search field (search for test user)
4. Try role filter dropdown
5. Try status filter dropdown
6. Click "Edit" on a user

- [ ] Pagination works ✅
- [ ] Search filters results ✅
- [ ] Role filter works ✅
- [ ] Status filter works ✅
- [ ] Edit modal opens ✅

### Test Admin User Editing
1. In edit modal:
2. Change Full Name field
3. Change Phone Number
4. Change Role from "user" to "admin"
5. Change Status to "Inactive"
6. Add reason (optional)
7. Click "Save Changes"

- [ ] Modal updates submit correctly ✅
- [ ] User data saves ✅
- [ ] No console errors ✅
- [ ] Audit log created (query database) ✅

### Test User Login & Redirect
1. Logout (if still logged in)
2. Go to `http://localhost:3000/login`
3. Login with user@test.com / TestPassword123!
4. Verify: You're on `/user` (not `/admin` or `/dashboard`)

- [ ] User redirected to `/user` ✅
- [ ] Only own profile shows ✅
- [ ] Page loads without errors ✅

### Test User Dashboard Features
1. On `/user` page:
2. See profile information
3. Email field shows (read-only)
4. Role field shows (read-only)
5. Status shows (read-only)
6. Click "Edit Profile" button

- [ ] Profile data displays correctly ✅
- [ ] Read-only fields are locked ✅
- [ ] Edit mode activates ✅

### Test User Profile Editing
1. In edit mode:
2. Change Full Name
3. Change Phone Number
4. Click "Save Changes"

- [ ] Changes save without errors ✅
- [ ] Cannot modify email/role/status ✅
- [ ] Form validates ✅

### Test User Cannot Access Admin
1. Logout
2. Login as regular user (user@test.com)
3. Try to access `http://localhost:3000/admin` directly

- [ ] Redirected to `/user` ✅
- [ ] Cannot see admin content ✅

### Test API Authorization
```bash
# Get admin token (from browser DevTools)
# 1. Open DevTools → Application → Cookies
# 2. Copy sb-access-token value
# 3. Set in terminal: ADMIN_TOKEN="<value>"

# Test admin endpoint (should work)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/users

# Test as user (should fail with 403)
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/admin/users
```

- [ ] Admin API access works ✅
- [ ] User API access returns 403 ✅

### Test Deactivation
1. As admin, edit a user
2. Set Status to "Inactive"
3. Save changes
4. Logout
5. Try to login as that deactivated user

- [ ] User cannot login ✅
- [ ] Error message shows "deactivated" ✅
- [ ] Audit log records deactivation ✅

---

## Step 5: Database Verification (Estimated: 5 minutes)

### Verify Tables Exist
```sql
-- Check all RBAC tables
\dt user_*
```

- [ ] user_roles table exists
- [ ] user_profiles table exists
- [ ] user_audit_log table exists

### Verify RLS Policies
```sql
-- Check policies on user_profiles
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

- [ ] At least 4-5 policies listed

### Verify Audit Trail
```sql
-- Check audit logs after admin actions
SELECT * FROM user_audit_log 
ORDER BY created_at DESC 
LIMIT 10;
```

- [ ] Recent admin actions appear
- [ ] Actions include: role_change, data_edit
- [ ] Old/new values are captured

### Verify Indexes
```sql
-- Check indexes for performance
SELECT * FROM pg_indexes 
WHERE tablename LIKE 'user_%';
```

- [ ] Indexes on role, is_active, email exist
- [ ] Indexes on audit log columns exist

---

## Step 6: Security Verification (Estimated: 10 minutes)

### Test Password Security
```bash
# Verify passwords are NOT stored in application
grep -r "password" src/ --include="*.ts" --include="*.tsx" | grep -v "signInWithPassword"
```

- [ ] No plain-text passwords in code
- [ ] Only using Supabase auth

### Test HTTPS/Security Headers
```bash
# In production (not dev), verify:
curl -I https://your-domain.com/admin
```

- [ ] HTTPS enabled in production
- [ ] Security headers present

### Test Session Hijacking Prevention
```bash
# Verify HTTP-only cookies
# DevTools → Application → Cookies
# Look for "HttpOnly" flag
```

- [ ] Session cookies are HTTP-only ✅
- [ ] Cannot be accessed by JavaScript ✅

### Test XSS Protection
```bash
# Try to inject script in form fields
# Click edit user → name field
# Try to input: <script>alert('xss')</script>
```

- [ ] Script is escaped/sanitized ✅
- [ ] No alert appears ✅

---

## Step 7: Error Handling Verification (Estimated: 5 minutes)

### Test 401 Unauthorized
```bash
# Try API without token
curl http://localhost:3000/api/admin/users
```

- [ ] Returns 401 Unauthorized ✅
- [ ] Error message in response ✅

### Test 403 Forbidden
```bash
# Try admin API as regular user
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/admin/users
```

- [ ] Returns 403 Forbidden ✅
- [ ] Error message in response ✅

### Test 404 Not Found
```bash
# Try to get non-existent user
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/users/invalid-uuid
```

- [ ] Returns 404 Not Found ✅
- [ ] Error message in response ✅

### Test Input Validation
```bash
# Try invalid role value
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  -X POST http://localhost:3000/api/admin/users/uuid \
  -H "Content-Type: application/json" \
  -d '{"role": "superadmin"}'
```

- [ ] Returns validation error ✅
- [ ] Invalid data not accepted ✅

---

## Step 8: Documentation Review

- [ ] Read `RBAC_QUICK_START.md`
- [ ] Review `RBAC_DOCUMENTATION.md`
- [ ] Understand permission matrix
- [ ] Know where audit logs are stored
- [ ] Know how to query user roles

---

## Step 9: Code Quality Checks

### TypeScript Compilation
```bash
npm run build
# or
pnpm build
```

- [ ] No TypeScript errors
- [ ] No compilation warnings
- [ ] Build succeeds

### Linting
```bash
npm run lint
# or
pnpm lint
```

- [ ] No critical linting errors
- [ ] No security warnings

### Review Code Comments
- [ ] All functions have JSDoc comments
- [ ] Complex logic has explanations
- [ ] Security considerations documented

---

## Step 10: Production Deployment Checklist

### Pre-Production
- [ ] All tests pass locally
- [ ] Database migration ran successfully
- [ ] Admin and user accounts created
- [ ] Build completes without errors
- [ ] No console errors or warnings

### Environment Variables
- [ ] NEXT_PUBLIC_SUPABASE_URL set
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY set
- [ ] SUPABASE_SERVICE_ROLE_KEY set (for server-side)
- [ ] NODE_ENV=production

### Database
- [ ] Migration applied to production database
- [ ] RLS policies enabled in production
- [ ] Indexes created for performance
- [ ] Backup taken before migration

### Security
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled (recommended)

### Monitoring
- [ ] Error logging configured
- [ ] User audit logs monitored
- [ ] Failed login attempts tracked
- [ ] Admin action alerts configured

### Final Tests in Production
- [ ] Admin login works
- [ ] User login works
- [ ] Admin dashboard accessible
- [ ] User dashboard accessible
- [ ] API endpoints respond correctly
- [ ] Audit logs recorded

---

## Step 11: Team Training

- [ ] Share `RBAC_QUICK_START.md` with team
- [ ] Share `RBAC_DOCUMENTATION.md` with team
- [ ] Run walkthrough of admin dashboard
- [ ] Explain permission matrix
- [ ] Document custom roles (if added)
- [ ] Create incident response plan

---

## Troubleshooting Guide

### Issue: User redirected to /login instead of /admin after login
**Solution:**
1. Check user_profiles table - does record exist?
2. Check role column - is it 'admin' or 'user'?
3. Check is_active column - is it true?
4. Clear browser cookies and try again

### Issue: 403 Forbidden on /api/admin/users
**Solution:**
1. Verify user is admin in database
2. Check session is still valid
3. Try logging out and back in
4. Check browser console for errors

### Issue: User can see other users' data
**Solution:**
1. Check RLS policies on user_profiles
2. Verify `id = auth.uid()` in SELECT policy
3. Check database RLS is enabled
4. Query: `SELECT * FROM pg_policies WHERE tablename = 'user_profiles'`

### Issue: Audit logs not recording
**Solution:**
1. Check user_audit_log table exists
2. Verify admin performing action
3. Check for SQL errors in API response
4. Review logAuditTrail() implementation

---

## Sign-Off

Once all items are checked, the RBAC system is ready for production.

### Signed Off By
- Developer: _________________ Date: _______
- QA/Tester: ________________ Date: _______
- DevOps/Deployment: ________ Date: _______

---

**Last Updated:** January 29, 2026  
**Version:** 1.0.0  
**Status:** Production-Ready

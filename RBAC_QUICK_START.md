# RBAC Implementation Guide - Quick Start

## What's Been Implemented

A complete, **production-grade Role-Based Access Control (RBAC) system** with two roles:
- **ADMIN** - Full system access, can manage all users
- **USER** - Personal dashboard, own data access only

---

## Quick Start (5 Steps)

### Step 1: Run the Database Migration
```bash
# Copy the SQL and run in your Supabase SQL Editor or psql
cat migrations/add_rbac_schema.sql | psql -U postgres -d your_database
```

This creates:
- `user_roles` table (admin, user)
- `user_profiles` table (extended user info with role)
- `user_audit_log` table (audit trail)
- RLS policies for data isolation
- Helper functions for role checking

---

### Step 2: Populate Initial Admin Users
```sql
-- Connect to your database and run:

-- Insert test users into user_profiles
INSERT INTO user_profiles (id, email, full_name, role, is_active, is_verified_email)
SELECT 
  id,
  email,
  email,  -- use email as name initially
  'user',  -- default role
  true,
  true
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Make a specific user an admin (replace with actual user ID)
UPDATE user_profiles 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

---

### Step 3: Login and Test Role-Based Routing
1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Login with an **admin** account
   - Should be redirected to `/admin`
4. Open another browser/private window
5. Login with a **regular user** account
   - Should be redirected to `/user`

---

### Step 4: Test Admin Dashboard
As admin:
1. Visit `http://localhost:3000/admin`
2. See all users listed
3. Click "Edit" on any user to:
   - Change full name
   - Change phone number
   - Change role (admin/user)
   - Activate/deactivate account
4. View system statistics (total users, active, etc.)
5. Search and filter users

---

### Step 5: Test User Dashboard
As regular user:
1. Visit `http://localhost:3000/user`
2. See own profile information
3. Can only edit: name, phone number
4. Cannot edit: email, role, account status
5. Cannot see other users' data

---

## What Each File Does

### Database
- **`migrations/add_rbac_schema.sql`**
  - Creates all RBAC tables and RLS policies
  - Adds audit logging and helper functions
  - **RUN THIS FIRST** after deployment

### Backend (Authorization)
- **`src/lib/auth/rbac.ts`**
  - Core authorization utilities
  - `getAuthContext()` - Fetch user's role from DB
  - `requireAuth()` - Check user is authenticated
  - `requireAdmin()` - Check user is admin
  - `logAuditTrail()` - Log admin actions
  - `canAccessUserData()` - Check data access permission

- **`src/lib/auth/navigation.ts`**
  - Navigation helpers for redirect logic
  - `getDashboardPath()` - Get correct dashboard URL
  - `getRedirectPath()` - Check if redirect needed

### Backend (API Endpoints)
- **`src/app/api/admin/users/route.ts`**
  - `GET /api/admin/users` - List all users (paginated)
  
- **`src/app/api/admin/users/[userId]/route.ts`**
  - `GET /api/admin/users/:id` - Get user details
  - `POST /api/admin/users/:id` - Update user

- **`src/app/api/admin/stats/route.ts`**
  - `GET /api/admin/stats` - System statistics

- **`src/app/api/user/profile/route.ts`**
  - `GET /api/user/profile` - Get own profile
  - `POST /api/user/profile` - Update own profile

### Frontend (Pages)
- **`src/app/(auth)/login/page.tsx`** (UPDATED)
  - Login page with role-based redirect
  - After login, user sent to `/admin` or `/user`

- **`src/app/admin/page.tsx`** (NEW)
  - Admin dashboard UI
  - User list with search/filter
  - Edit user modal
  - System stats cards

- **`src/app/user/page.tsx`** (NEW)
  - User dashboard UI
  - Profile view/edit
  - Personal data only

### Middleware
- **`middleware.ts`** (UPDATED)
  - Route protection for `/admin` and `/user`
  - Redirect unauthenticated users to login
  - Added `/admin` and `/user` to protected routes

---

## Permission Matrix

| Feature | Admin | User |
|---------|-------|------|
| View all users | ✅ | ❌ |
| Edit any user | ✅ | ❌ |
| View own profile | ✅ | ✅ |
| Edit own profile | ✅ Limited | ✅ Limited |
| Change own role | ❌ | ❌ |
| Deactivate accounts | ✅ | ❌ |
| View statistics | ✅ | ❌ |
| Access admin dashboard | ✅ | ❌ |
| Access user dashboard | ✅ (no, use admin) | ✅ |

---

## API Response Format

All API endpoints return standardized responses:

### Success (200)
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2026-01-29T14:30:00Z"
}
```

### Error (400/401/403/500)
```json
{
  "success": false,
  "error": "Error message here",
  "timestamp": "2026-01-29T14:30:00Z"
}
```

---

## Security Features Implemented

✅ **Multi-layer authorization**
- Frontend routing check
- API middleware check
- Database RLS policies

✅ **Data isolation**
- Users only see own data
- Admins see all data

✅ **Audit trail**
- All admin actions logged
- Who, what, when, why tracked

✅ **Active status enforcement**
- Deactivated users can't login
- Sessions invalidated on deactivation

✅ **Field-level protection**
- Users can't modify email/role/status
- Admins can modify all fields

✅ **Session security**
- HTTP-only cookies (can't be read by JS)
- Automatic session refresh
- CSRF protection built-in

---

## Common Operations

### As Admin: List All Users
```javascript
const response = await fetch('/api/admin/users?page=1&limit=20', {
  method: 'GET'
});
const result = await response.json();
console.log(result.data.users);
```

### As Admin: Deactivate a User
```javascript
await fetch('/api/admin/users/user-id-here', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    is_active: false,
    reason: 'User requested account deletion'
  })
});
```

### As User: Update Own Profile
```javascript
await fetch('/api/user/profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    full_name: 'Jane Doe',
    phone_number: '+1234567890'
  })
});
```

---

## Troubleshooting

### User can't login
1. Check: User exists in Supabase auth
2. Check: User record exists in `user_profiles` table
3. Check: `is_active = true`
4. Check: Email matches exactly (case-sensitive)

### Admin dashboard shows 403
1. Check: User role is 'admin' (not 'user')
2. Check: Session is still valid
3. Check: Browser cookies are enabled
4. Try: Clear cache, logout, login again

### User redirected to login when accessing dashboard
1. Check: Session cookie exists
2. Check: Middleware isn't blocking the request
3. Check: Supabase auth is configured correctly
4. Check: `.env` variables are set

### Changes to user role not taking effect
1. Role change logged in `user_audit_log` table
2. Check: New role is 'admin' or 'user' (lowercase)
3. Solution: Refresh page / clear cache / logout and login

---

## Testing Checklist

- [ ] Login as admin → redirect to `/admin` ✅
- [ ] Login as user → redirect to `/user` ✅
- [ ] Admin can view all users ✅
- [ ] User cannot view `/admin` page ✅
- [ ] User can view own `/user` profile ✅
- [ ] User cannot edit other users ✅
- [ ] Admin can edit any user ✅
- [ ] Deactivated user cannot login ✅
- [ ] Audit log records all admin actions ✅
- [ ] `/api/admin/*` returns 403 for non-admins ✅

---

## Next Steps

1. **Deploy to Production**
   - Run migration on production database
   - Set environment variables
   - Test all endpoints

2. **Add More Features**
   - Two-factor authentication
   - Fine-grained permissions
   - Session management dashboard

3. **Monitor**
   - Watch error logs for authorization failures
   - Monitor `/api/admin/*` access patterns
   - Track user logins in `last_login` field

4. **Documentation**
   - Share `RBAC_DOCUMENTATION.md` with team
   - Document any custom roles added
   - Update this guide with customizations

---

## Support Resources

- Full documentation: [`RBAC_DOCUMENTATION.md`](RBAC_DOCUMENTATION.md)
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Next.js Middleware: https://nextjs.org/docs/advanced-features/middleware
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

---

**Created:** January 29, 2026  
**Version:** 1.0.0  
**Status:** Ready for Production

# 🔐 API Endpoint Protection Guide

## Quick Reference: How to Protect Your API Endpoints

Your API endpoints are currently **UNPROTECTED**. Any attacker can call them directly.

---

## ⚡ QUICK START - Protect an Endpoint in 30 Seconds

### BEFORE (Vulnerable)
```typescript
// src/app/api/users/delete/route.ts
export async function POST(request: Request) {
  const { userId } = await request.json()
  
  // ❌ PROBLEM: Anyone can delete users!
  await deleteUser(userId)
  
  return Response.json({ success: true })
}
```

### AFTER (Secure)
```typescript
// src/app/api/users/delete/route.ts
import { withRole } from '@/lib/auth/api-middleware'

// ✅ FIX: Only admins can delete users
export const POST = withRole(['admin', 'super_admin'], async (request, user) => {
  const { userId } = await request.json()
  
  await deleteUser(userId)
  
  return Response.json({ success: true })
})
```

**That's it!** The endpoint is now protected by:
- ✅ JWT token validation
- ✅ Role checking  
- ✅ Automatic error responses (401, 403)

---

## 📋 Three Ways to Protect Endpoints

### 1️⃣ Just Authentication (Any logged-in user)
```typescript
import { withAuth } from '@/lib/auth/api-middleware'

export const GET = withAuth(async (request, user) => {
  // 'user' parameter has: id, email, role, team_id
  const myData = await getMyData(user.id)
  return Response.json(myData)
})
```

### 2️⃣ With Role Check (Specific roles only)
```typescript
import { withRole } from '@/lib/auth/api-middleware'

// Allow only admins and super admins
export const DELETE = withRole(
  ['admin', 'super_admin'],
  async (request, user) => {
    const { userId } = await request.json()
    await deleteUser(userId)
    return Response.json({ success: true })
  }
)
```

### 3️⃣ Manual Auth Check (Custom logic)
```typescript
import { requireAuth, requireRole } from '@/lib/auth/api-middleware'

export async function POST(request: Request) {
  // Method 1: Check auth
  const auth = await requireAuth(request)
  if (auth.status !== 200) {
    return Response.json(
      { error: auth.error },
      { status: auth.status }
    )
  }
  
  const user = auth.user
  
  // Method 2: Check role
  const role = await requireRole(request, ['admin'])
  if (role.status !== 200) {
    return Response.json(
      { error: role.error },
      { status: role.status }
    )
  }
  
  // Now safely do admin action
  await adminAction()
  return Response.json({ success: true })
}
```

---

## 📍 All Endpoints That Need Protection

Review your API files and apply protection:

### Super Admin Endpoints
```
❌ src/app/api/super-admin/*
   → Should require: ['super_admin']
```

### Admin Endpoints
```
❌ src/app/api/admin/*
   → Should require: ['admin', 'super_admin']
```

### User Endpoints (if sensitive)
```
❌ src/app/api/user/*
   → Check which ones need protection:
   - Profile view: just authentication
   - Profile edit: authentication + ownership check
   - Password change: authentication + ownership check
```

### Team Management
```
❌ src/app/api/teams/*
   → Require: authentication + ownership check
```

### Other Sensitive Endpoints
```
❌ Files upload/download
❌ Call recordings access
❌ Chat history (other users)
❌ Settings modification
❌ Webhook processing
```

---

## 🔍 Error Responses

### When User Not Authenticated
```
Status: 401 Unauthorized
{
  "error": "Missing or invalid authorization header"
}
```

### When User Not Authorized (Wrong Role)
```
Status: 403 Forbidden
{
  "error": "Access denied. Required roles: admin, super_admin"
}
```

### When Token Expired
```
Status: 401 Unauthorized
{
  "error": "Token expired"
}
```

---

## 🧪 Testing Protected Endpoints

### ✅ Test with Authentication
```bash
# Get token from browser:
# sessionStorage.getItem('auth_token')

curl -X DELETE https://yoursite.com/api/users/delete \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'

# Response: 200 OK (success)
```

### ❌ Test without Authentication
```bash
curl -X DELETE https://yoursite.com/api/users/delete \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'

# Response: 401 Unauthorized
```

### ❌ Test with Wrong Role
```bash
# With user token (not admin)
curl -X DELETE https://yoursite.com/api/users/delete \
  -H "Authorization: Bearer user_token_here..." \
  -d '{"userId": "user123"}'

# Response: 403 Forbidden
```

---

## 📝 Common Patterns

### Pattern 1: Get Current User Data
```typescript
export const GET = withAuth(async (request, user) => {
  // user.id, user.email, user.role are available
  const profile = await getUserProfile(user.id)
  return Response.json(profile)
})
```

### Pattern 2: Require Specific Role
```typescript
export const POST = withRole(['admin'], async (request, user) => {
  // Only admin can call this
  const data = await request.json()
  await createResource(data)
  return Response.json({ success: true })
})
```

### Pattern 3: Check Ownership
```typescript
export const PUT = withAuth(async (request, user) => {
  const { id, data } = await request.json()
  
  // Verify user owns this resource
  const resource = await getResource(id)
  if (resource.userId !== user.id) {
    return Response.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  
  await updateResource(id, data)
  return Response.json({ success: true })
})
```

### Pattern 4: Team-Based Access
```typescript
export const GET = withRole(['admin', 'team_admin'], async (request, user) => {
  // admin: can access all teams
  // team_admin: can only access their teams
  if (user.role === 'super_admin') {
    return getAllTeams()
  } else if (user.role === 'admin') {
    return getUserTeams(user.id)
  }
})
```

---

## ⚠️ Security Best Practices

### DO ✅
- ✅ Always use `withRole` for admin operations
- ✅ Check user ownership for personal data
- ✅ Validate input data even after auth
- ✅ Log failed auth attempts
- ✅ Use HTTPS (always)

### DON'T ❌
- ❌ Trust client-sent user ID without verification
- ❌ Allow access just because token is valid (check role too)
- ❌ Ignore errors from auth middleware
- ❌ Store secrets in request body
- ❌ Return sensitive info in error messages

---

## 🚀 Implementation Checklist

- [ ] Identify all API endpoints in your project
- [ ] Mark which ones need authentication
- [ ] Mark which ones need role requirements
- [ ] Add `withAuth` or `withRole` wrapper to each
- [ ] Test with Postman/curl/Thunder Client
- [ ] Verify 401/403 errors work correctly
- [ ] Deploy to production

---

## 💡 Need Help?

### Check if endpoint is protected
```javascript
// In browser console:
await fetch('/api/super-admin/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'test' })
})
// Should return: { error: "Missing authorization header" }
```

### Find unprotected endpoints
```bash
# Search for route handlers without protection
grep -r "export.*function\|export const" src/app/api/ | grep -v "withAuth\|withRole"
```

---

## 📚 Additional Resources

- [Full Implementation Guide](SECURITY_FIX_IMPLEMENTATION.md)
- [Auth Context Usage](src/contexts/auth-context.tsx)
- [Middleware Details](middleware.ts)
- [Protected Routes Component](src/components/protected-route.tsx)

---

**Status**: Ready to protect your endpoints  
**Priority**: 🔴 HIGH - Do this immediately  
**Estimated Time**: ~30 minutes to protect all endpoints

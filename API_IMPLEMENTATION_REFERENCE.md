# API Implementation Reference

## Complete Endpoint Overview

### Authentication Middleware Pattern

All endpoints use this 3-layer security pattern:

```typescript
// Layer 1: Check authentication
const auth = await requireAuth();

// Layer 2: Check role hierarchy
requireSuperAdmin(auth);  // or requireTeamAccess(auth, teamId, role)

// Layer 3: Execute with access control
const result = await getTeamMembers(teamId, auth);

// Layer 4: Audit logging
await logTeamAudit(teamId, auth.userId, action, before, after, reason);
```

---

## Super Admin Endpoints

### 1. Create Admin User

**Endpoint**: `POST /api/super-admin/create-admin`

**Access**: SUPER_ADMIN only

**Request**:
```json
{
  "email": "newadmin@company.com",
  "password": "StrongPass123!",
  "fullName": "John Admin",
  "role": "admin",
  "teamIds": ["uuid-1", "uuid-2"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "newadmin@company.com",
    "fullName": "John Admin",
    "role": "admin",
    "teams": [
      {"teamId": "uuid-1", "role": "admin"},
      {"teamId": "uuid-2", "role": "admin"}
    ]
  }
}
```

**Error Cases**:
- Email already exists → 400
- Invalid role → 400
- Team IDs don't exist → 400
- User creation fails → 400

**Audit**: Logs "admin_created" with full details

---

### 2. List Admins

**Endpoint**: `GET /api/super-admin/admins`

**Access**: SUPER_ADMIN only

**Response**:
```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "id": "user-id",
        "email": "admin@company.com",
        "fullName": "Admin Name",
        "role": "admin",
        "status": "active",
        "teams": [
          {"teamId": "team-1", "teamName": "Sales", "role": "admin"}
        ],
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-20T15:30:00Z"
      }
    ],
    "total": 5
  }
}
```

---

### 3. Update Admin

**Endpoint**: `PUT /api/super-admin/admins/:adminId`

**Access**: SUPER_ADMIN only

**Request**:
```json
{
  "role": "team_admin",
  "status": "active"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Admin updated",
    "admin": {
      "id": "user-id",
      "role": "team_admin",
      "status": "active",
      "updatedAt": "2024-01-20T16:00:00Z"
    }
  }
}
```

---

### 4. Delete Admin (Soft Delete)

**Endpoint**: `DELETE /api/super-admin/admins/:adminId`

**Access**: SUPER_ADMIN only

**Behavior**:
- Sets role to USER
- Sets status to INACTIVE
- Removes from all teams
- Logs deletion action

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Admin account deactivated"
  }
}
```

**Restrictions**:
- Cannot delete own admin account
- Soft delete preserves audit trail

---

### 5. List Teams

**Endpoint**: `GET /api/super-admin/teams`

**Access**: Authenticated users

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "team-id",
      "name": "Sales Team",
      "description": "Sales department",
      "status": "active",
      "createdAt": "2024-01-10T09:00:00Z",
      "createdBy": "super-admin-id"
    }
  ]
}
```

**Behavior**:
- SUPER_ADMIN: Returns all teams
- ADMIN: Returns all teams
- TEAM_ADMIN: Returns only their teams
- USER: Returns only their teams

---

### 6. Create Team

**Endpoint**: `POST /api/super-admin/teams`

**Access**: SUPER_ADMIN only

**Request**:
```json
{
  "name": "Marketing Team",
  "description": "Marketing and communications"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new-team-id",
    "name": "Marketing Team",
    "description": "Marketing and communications",
    "status": "active",
    "createdBy": "super-admin-id",
    "createdAt": "2024-01-20T16:30:00Z"
  }
}
```

**Audit**: Logs "team_created"

---

### 7. Update Team

**Endpoint**: `PUT /api/super-admin/teams/:teamId`

**Access**: SUPER_ADMIN only

**Request**:
```json
{
  "name": "Updated Team Name",
  "description": "Updated description",
  "status": "active"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Team updated",
    "team": {
      "id": "team-id",
      "name": "Updated Team Name",
      "updatedAt": "2024-01-20T17:00:00Z"
    }
  }
}
```

---

### 8. Delete Team (Soft Delete)

**Endpoint**: `DELETE /api/super-admin/teams/:teamId`

**Access**: SUPER_ADMIN only

**Behavior**:
- Sets status to INACTIVE
- Preserves team_members records
- Maintains audit trail
- Users can view archived team (if needed)

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Team archived"
  }
}
```

---

## Admin Endpoints (Team Management)

### 9. List Team Members

**Endpoint**: `GET /api/admin/teams/:teamId/members`

**Access**: Any team member

**Response**:
```json
{
  "success": true,
  "data": {
    "teamId": "team-id",
    "members": [
      {
        "id": "member-id",
        "userId": "user-id",
        "email": "user@company.com",
        "fullName": "John User",
        "userRole": "user",
        "teamRole": "member",
        "joinedAt": "2024-01-15T10:00:00Z"
      },
      {
        "id": "member-id-2",
        "userId": "admin-id",
        "email": "teamadmin@company.com",
        "fullName": "Jane Admin",
        "userRole": "admin",
        "teamRole": "admin",
        "joinedAt": "2024-01-10T09:00:00Z"
      }
    ],
    "total": 2
  }
}
```

---

### 10. Assign User to Team

**Endpoint**: `PUT /api/admin/teams/:teamId/assign-user`

**Access**: Team admin or owner

**Request**:
```json
{
  "userId": "user-id",
  "role": "member"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Member added to team",
    "member": {
      "id": "member-id",
      "userId": "user-id",
      "role": "member",
      "createdAt": "2024-01-20T17:30:00Z"
    }
  }
}
```

**Behavior**:
- If user not in team: Adds new member
- If user in team: Updates role
- Validates user exists
- Creates audit log entry

**Valid Roles**: "member", "admin", "owner"

---

### 11. Remove User from Team

**Endpoint**: `DELETE /api/admin/teams/:teamId/remove-user`

**Access**: Team admin or owner

**Request**:
```json
{
  "userId": "user-id"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Member removed from team"
  }
}
```

**Audit**: Logs "member_removed" with user details

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Status Codes

```
200 - OK
201 - Created
400 - Bad Request (validation error)
401 - Unauthorized (not authenticated)
403 - Forbidden (insufficient permissions)
404 - Not Found
409 - Conflict (already exists)
500 - Internal Server Error
```

### Example Error Cases

#### Missing Authentication
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

#### Insufficient Permissions
```json
{
  "success": false,
  "error": "You do not have permission to manage this team",
  "code": "FORBIDDEN"
}
```

#### Validation Error
```json
{
  "success": false,
  "error": "Invalid role. Must be member, admin, or owner",
  "code": "INVALID_ROLE"
}
```

---

## Audit Logging

### What Gets Logged

Every team-related action is logged with:

```typescript
{
  teamId: string;              // Which team
  actorId: string;             // Who did it
  action: string;              // What action
  beforeState: object;         // Previous state
  afterState: object;          // New state
  reason: string;              // Why (optional)
  timestamp: DateTime;         // When
}
```

### Example Log Entries

#### Member Added
```json
{
  "teamId": "team-1",
  "actorId": "admin-1",
  "action": "member_added",
  "beforeState": null,
  "afterState": {
    "user_id": "user-123",
    "role": "member"
  },
  "reason": "Added john@company.com to team with role member",
  "createdAt": "2024-01-20T17:30:00Z"
}
```

#### Role Changed
```json
{
  "teamId": "team-1",
  "actorId": "admin-1",
  "action": "member_role_changed",
  "beforeState": { "role": "member" },
  "afterState": { "role": "admin" },
  "reason": "Promoted user to team admin",
  "createdAt": "2024-01-20T17:45:00Z"
}
```

---

## Testing Endpoints

### Using cURL

#### Create Admin
```bash
curl -X POST http://localhost:3000/api/super-admin/create-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "email": "test@company.com",
    "password": "TestPass123!",
    "fullName": "Test Admin",
    "role": "admin",
    "teamIds": ["team-1"]
  }'
```

#### List Teams
```bash
curl -X GET http://localhost:3000/api/super-admin/teams \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Add Team Member
```bash
curl -X PUT http://localhost:3000/api/admin/teams/team-id/assign-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user-id",
    "role": "member"
  }'
```

### Using TypeScript

```typescript
// Create admin
const response = await fetch('/api/super-admin/create-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@company.com',
    password: 'StrongPass123!',
    fullName: 'New Admin',
    role: 'admin',
    teamIds: ['team-1']
  })
});

const data = await response.json();
if (data.success) {
  console.log('Admin created:', data.data);
} else {
  console.error('Error:', data.error);
}
```

---

## Rate Limiting Considerations

For production deployment, consider adding:

```typescript
// Suggested rate limits
- Create admin: 10 requests/hour
- List teams: 100 requests/hour
- Add member: 50 requests/hour
- Bulk operations: 5 requests/hour
```

---

## Database Indexes for Performance

```sql
-- Optimize common queries
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_audit_team_id ON team_audit_log(team_id);
CREATE INDEX idx_team_audit_created_at ON team_audit_log(created_at);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
```

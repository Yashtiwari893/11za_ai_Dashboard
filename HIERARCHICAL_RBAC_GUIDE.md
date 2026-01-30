# Hierarchical Role-Based Access Control (RBAC) System

## Overview

This document describes the hierarchical role-based access control system that extends the basic RBAC with:
- **3-tier role hierarchy**: SUPER_ADMIN > ADMIN > USER
- **Team-based organization**: Users organized into teams
- **Team roles**: Owner, Admin, Member
- **Comprehensive audit logging**: All actions tracked with who/what/when/why

---

## Architecture

### Role Hierarchy

```
┌─ SUPER_ADMIN (System Level)
│  └─ Full system access
│  └─ Can manage all teams and users
│  └─ Can create/delete admins
│  └─ Can manage system-wide settings
│
├─ ADMIN (System Level - All Teams)
│  └─ Can manage all teams
│  └─ Can assign users to teams
│  └─ Cannot create other admins
│
├─ TEAM_ADMIN (Team-Scoped)
│  └─ Can only manage assigned teams
│  └─ Can assign users within their teams
│  └─ Limited to specific team scope
│
└─ USER (Data Access Only)
   └─ Can only access own data
   └─ Can view assigned teams
   └─ Read-only access
```

### Team Structure

```
Teams
├── team_id
├── name
├── description
├── status (active/inactive)
├── created_by (super_admin id)
├── created_at
└── Team Members
    ├── user_id
    ├── role (owner/admin/member)
    └── joined_at
```

---

## Database Schema

### Core Tables

#### `teams`
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `team_members`
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);
```

#### `team_audit_log`
```sql
CREATE TABLE team_audit_log (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id),
  actor_id UUID NOT NULL REFERENCES user_profiles(id),
  action VARCHAR(255) NOT NULL,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Updated `user_profiles`

The existing `user_profiles` table now supports hierarchical roles:

```sql
ALTER TABLE user_profiles ADD COLUMN role VARCHAR(20) DEFAULT 'user';
-- Valid values: 'super_admin', 'admin', 'team_admin', 'user'

-- Ensure role constraints
ALTER TABLE user_profiles 
ADD CONSTRAINT valid_roles 
CHECK (role IN ('super_admin', 'admin', 'team_admin', 'user'));
```

### Row Level Security (RLS) Policies

#### Teams Table
- **Super Admin**: Can read/write all teams
- **Admin**: Can read/write all teams
- **Team Admin**: Can read/write only their teams
- **User**: Can read only their teams

#### Team Members Table
- **Super Admin**: Can manage all team members
- **Team Owner**: Can manage team members
- **Team Admin**: Can manage team members
- **Team Member**: Read-only

#### Team Audit Log
- **Super Admin**: Can read all logs
- **Actors**: Can read their own logs
- **Others**: No access

---

## Authorization Middleware

File: `src/lib/auth/hierarchical-rbac.ts`

### Key Functions

#### `getAuthContext(session)`
Returns the complete auth context including role hierarchy and team info:

```typescript
interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isTeamAdmin: boolean;
  isUser: boolean;
  teams: TeamInfo[];
  status: 'active' | 'inactive';
}
```

#### `requireAuth()`
Enforces authentication. Throws error if not authenticated.

#### `requireSuperAdmin(auth)`
Enforces SUPER_ADMIN role. Throws error if not SUPER_ADMIN.

#### `requireTeamAccess(auth, teamId, minRole)`
Validates user is in team with required role:

```typescript
// Example
await requireTeamAccess(auth, teamId, TeamMemberRole.ADMIN);
```

#### `canManageTeam(auth, teamId)`
Checks if user can manage (admin/owner) the team.

#### `getUserTeams(userId)`
Gets all teams for a user with their role in each.

#### `getTeamMembers(teamId, auth)`
Gets team members with access control validation.

#### `logTeamAudit(teamId, actorId, action, beforeState, afterState, reason)`
Logs action to audit trail with complete context.

---

## API Endpoints

### Super Admin Endpoints

#### Create Admin
**POST** `/api/super-admin/create-admin`

```json
{
  "email": "admin@company.com",
  "password": "secure_password",
  "fullName": "Admin Name",
  "role": "admin",
  "teamIds": ["team-1", "team-2"]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "admin@company.com",
    "role": "admin",
    "teams": ["team-1", "team-2"]
  }
}
```

#### List Admins
**GET** `/api/super-admin/admins`

Returns all admin and team_admin users with their team assignments.

#### Update Admin
**PUT** `/api/super-admin/admins/:adminId`

```json
{
  "role": "team_admin",
  "status": "active"
}
```

#### Delete Admin (Soft Delete)
**DELETE** `/api/super-admin/admins/:adminId`

Sets admin role to USER and status to INACTIVE.

#### List Teams
**GET** `/api/super-admin/teams`

Returns all teams for SUPER_ADMIN, or user's teams for ADMIN.

#### Create Team
**POST** `/api/super-admin/teams`

```json
{
  "name": "Sales Team",
  "description": "Sales department users"
}
```

#### Update Team
**PUT** `/api/super-admin/teams/:teamId`

```json
{
  "name": "Updated Team Name",
  "description": "Updated description",
  "status": "active"
}
```

#### Delete Team
**DELETE** `/api/super-admin/teams/:teamId`

Soft deletes by setting status to INACTIVE.

### Team Management Endpoints

#### List Team Members
**GET** `/api/admin/teams/:teamId/members`

Returns all members with their roles and join dates.

#### Assign User to Team
**PUT** `/api/admin/teams/:teamId/assign-user`

```json
{
  "userId": "user-id",
  "role": "member"
}
```

#### Remove User from Team
**DELETE** `/api/admin/teams/:teamId/remove-user`

```json
{
  "userId": "user-id"
}
```

---

## Frontend Components

### Super Admin Dashboard
**File**: `src/app/super-admin/page.tsx`

Features:
- Create new admins with email/password
- Manage admin roles and status
- List all teams
- Create new teams
- View team members
- Add/remove members from teams

**Access**: SUPER_ADMIN only

### Admin Dashboard (Team-Scoped)
**File**: `src/app/admin/page.tsx`

Features:
- View assigned teams
- Manage team members
- Add users to teams
- Remove users from teams
- View team details

**Access**: ADMIN or TEAM_ADMIN

### User Dashboard
**File**: `src/app/user/page.tsx`

Features:
- View assigned teams (read-only)
- View team members
- Personal profile management

**Access**: USER, ADMIN, TEAM_ADMIN, SUPER_ADMIN

---

## Implementation Guide

### 1. Initial Setup

Run the database migration:

```bash
# Create the new tables and RLS policies
psql -U postgres -d chatbot_db -f migrations/add_hierarchical_teams_schema.sql
```

### 2. Create Super Admin

```bash
# Run this SQL to create the first super admin
UPDATE user_profiles
SET role = 'super_admin'
WHERE id = 'your-super-admin-id'
AND status = 'active';
```

### 3. Create First Team

Use the Super Admin Dashboard to create teams and assign admins.

### 4. Add Users to Teams

Use Admin or Super Admin dashboard to assign users to teams.

---

## Security Best Practices

### 1. Authorization Hierarchy
- Always check role at API level
- Always check role at database level (RLS)
- Verify team membership before granting access

### 2. Audit Logging
- All team modifications are logged
- Includes who made the change, when, and why
- Enables accountability and troubleshooting

### 3. Soft Deletes
- Admin deactivation doesn't delete user data
- Teams can be archived instead of deleted
- Maintains data integrity and audit trails

### 4. Role Enforcement
- Multi-layer validation (frontend → API → database)
- No single point of failure
- Cascading permission checks

### 5. Password Security
- Passwords hashed by Supabase Auth
- No plain text password storage
- Use strong passwords (12+ chars, mixed case, symbols)

---

## Common Workflows

### Creating a New Team Lead

1. Create user account (signup flow)
2. Login to Super Admin Dashboard
3. Create new team (name, description)
4. Create Team Admin for that team
5. Assign Team Admin to team with "owner" role
6. Team Admin can now assign users to their team

### Transferring Team Ownership

1. Go to Super Admin Dashboard
2. Select team
3. Find current owner
4. Remove owner from team
5. Find new owner
6. Assign new owner with "owner" role
7. Audit log records the transfer

### Bulk User Assignment

1. Create team
2. Go to Admin Dashboard
3. Select team
4. Use "Add Member" dialog multiple times
5. Set role as "member"
6. All changes logged automatically

---

## Troubleshooting

### "FORBIDDEN" Error on Team Access

**Cause**: User not in team with required role

**Solution**:
1. Check team_members table for user
2. Verify user has correct team role
3. Add user to team via Admin Dashboard

### Admin Can't See Teams

**Cause**: Admin not assigned to any teams

**Solution**:
1. Go to Super Admin Dashboard
2. Find admin user
3. Create or assign to team
4. Admin will see teams after refresh

### Audit Log Missing Entry

**Cause**: RLS policy blocking insert

**Solution**:
1. Verify actor_id is current user
2. Verify team_id exists and is active
3. Check user permissions in team

---

## Migration from Basic RBAC

If migrating from the basic 2-tier system:

1. Run migration: `add_hierarchical_teams_schema.sql`
2. Create initial teams based on department/function
3. Assign existing admins to appropriate teams
4. Update admin user roles from "admin" to "admin" or "team_admin"
5. Test access on both dashboards
6. Update routing if needed
7. Monitor audit logs for any issues

---

## Performance Considerations

### Team Membership Queries
- Use indexed lookups on `team_members(team_id, user_id)`
- Batch load team membership in getAuthContext
- Cache team info in auth context

### Large Team Management
- Paginate team member lists in UI
- Use database-level filtering for role checks
- Avoid N+1 queries with proper joins

### Audit Log Growth
- Archive audit logs quarterly
- Index on `team_id` and `created_at`
- Purge logs > 2 years old

---

## API Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 401 | Authentication required | No valid session |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | Not found | Resource doesn't exist |
| 400 | Bad request | Invalid input data |
| 409 | Conflict | Resource already exists |
| 500 | Internal error | Server error |

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [RBAC Patterns](https://en.wikipedia.org/wiki/Role-based_access_control)

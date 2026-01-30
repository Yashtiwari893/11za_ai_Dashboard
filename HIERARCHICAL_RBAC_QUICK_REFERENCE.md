# Hierarchical RBAC - Quick Reference

## Files Created/Modified

### Database
- ✅ `migrations/add_hierarchical_teams_schema.sql` - Complete schema with RLS policies

### Backend Libraries
- ✅ `src/lib/auth/hierarchical-rbac.ts` - Authorization middleware

### API Endpoints
- ✅ `src/app/api/super-admin/create-admin/route.ts` - Create admin users
- ✅ `src/app/api/super-admin/admins/route.ts` - List, update, delete admins
- ✅ `src/app/api/super-admin/teams/route.ts` - Create and list teams
- ✅ `src/app/api/admin/teams/[teamId]/manage-members/route.ts` - Assign/remove members
- ✅ `src/app/api/admin/teams/[teamId]/members/route.ts` - List team members

### Frontend Pages
- ✅ `src/app/super-admin/page.tsx` - Super Admin Dashboard
- ✅ `src/app/admin/page.tsx` - Admin Dashboard (updated)

### Documentation
- ✅ `HIERARCHICAL_RBAC_GUIDE.md` - Complete system guide
- ✅ `API_IMPLEMENTATION_REFERENCE.md` - API endpoint reference
- ✅ `DEPLOYMENT_GUIDE.md` - Deployment and operations guide

---

## Role Hierarchy

```
SUPER_ADMIN
├─ Create/manage admins
├─ Create/manage all teams
├─ Manage all team members
└─ View all audit logs

ADMIN
├─ Manage all teams (but can't create admins)
├─ Assign users to teams
└─ View team-scoped audit logs

TEAM_ADMIN
├─ Manage only assigned teams
├─ Assign users within their teams
└─ View their team's audit logs

USER
└─ View assigned teams (read-only)
```

---

## API Quick Reference

### Super Admin APIs
```
POST   /api/super-admin/create-admin              Create new admin
GET    /api/super-admin/admins                    List all admins
PUT    /api/super-admin/admins/:id                Update admin
DELETE /api/super-admin/admins/:id                Delete admin (soft)
GET    /api/super-admin/teams                     List teams
POST   /api/super-admin/teams                     Create team
PUT    /api/super-admin/teams/:id                 Update team
DELETE /api/super-admin/teams/:id                 Delete team (soft)
```

### Admin APIs
```
GET    /api/admin/teams/:teamId/members           List team members
PUT    /api/admin/teams/:teamId/assign-user       Add user to team
DELETE /api/admin/teams/:teamId/remove-user       Remove user from team
```

---

## Common Workflows

### Create New Team with Admin
```bash
# 1. Super Admin creates team
POST /api/super-admin/teams
{ "name": "Sales", "description": "Sales dept" }

# 2. Super Admin creates admin
POST /api/super-admin/create-admin
{
  "email": "sales-admin@company.com",
  "password": "...",
  "fullName": "Sales Admin",
  "role": "team_admin",
  "teamIds": ["team-id"]
}

# 3. Admin adds team members
PUT /api/admin/teams/team-id/assign-user
{ "userId": "user-id", "role": "member" }
```

### Update User Role in Team
```bash
# Admin updates member role
PUT /api/admin/teams/team-id/assign-user
{ "userId": "user-id", "role": "admin" }
```

### Remove User from Team
```bash
# Admin removes member
DELETE /api/admin/teams/team-id/remove-user
{ "userId": "user-id" }
```

---

## Security Checklist

- ✅ 3-layer authorization (frontend → API → database)
- ✅ Row-level security (RLS) policies enforced
- ✅ All actions audit logged
- ✅ Soft deletes preserve data
- ✅ Role hierarchy strictly enforced
- ✅ Password hashed by Supabase Auth
- ✅ Session-based authentication
- ✅ Comprehensive error handling

---

## Testing Endpoints

### Create Admin (Super Admin)
```bash
curl -X POST http://localhost:3000/api/super-admin/create-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!@",
    "fullName": "Test Admin",
    "role": "admin",
    "teamIds": []
  }'
```

### List Teams
```bash
curl http://localhost:3000/api/super-admin/teams \
  -H "Authorization: Bearer TOKEN"
```

### Add Team Member
```bash
curl -X PUT http://localhost:3000/api/admin/teams/TEAM_ID/assign-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "userId": "USER_ID",
    "role": "member"
  }'
```

---

## Database Schema Summary

### Tables
- `teams` - Team/organization records
- `team_members` - User-team mappings
- `team_audit_log` - Action history
- `user_profiles` - Updated with role hierarchy

### Key Columns
- `user_profiles.role` - SUPER_ADMIN, ADMIN, TEAM_ADMIN, or USER
- `team_members.role` - OWNER, ADMIN, or MEMBER (within team)
- `teams.status` - ACTIVE or INACTIVE

### Indexes
- `team_members(user_id, team_id)`
- `team_audit_log(team_id, created_at)`
- `user_profiles(role)`

---

## Deployment Checklist

- [ ] Database migration run
- [ ] Super Admin created
- [ ] Initial team created
- [ ] RLS policies verified
- [ ] API endpoints tested
- [ ] Dashboards working
- [ ] Error handling tested
- [ ] Audit logging verified
- [ ] Team trained
- [ ] Users notified
- [ ] Monitor for 24 hours

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Not authenticated | Login required |
| 403 | No permission | Check role/team |
| 404 | Not found | Verify ID exists |
| 400 | Bad request | Check input data |
| 409 | Already exists | Item duplicated |
| 500 | Server error | Check logs |

---

## Troubleshooting

### Users can't see teams
- Verify user in team_members table
- Check team status is ACTIVE
- Check RLS policies

### Admin can't create users
- Verify admin role is ADMIN or SUPER_ADMIN
- Check admin status is ACTIVE
- Review error message for details

### Audit logs missing
- Check RLS policies allow insert
- Verify actor_id = current user
- Check disk space

### Slow queries
- Run: `ANALYZE teams; ANALYZE team_members;`
- Create indexes if missing
- Check slow query log

---

## Performance Baselines

- Create admin: < 500ms
- List teams: < 200ms
- Add member: < 300ms
- List members: < 150ms
- Audit log insert: < 50ms

---

## Next Steps

1. ✅ Run database migration
2. ✅ Create first Super Admin
3. ✅ Create initial teams
4. ✅ Create team admins
5. ✅ Test dashboards
6. ✅ Monitor performance
7. ✅ Gather user feedback
8. ✅ Document learnings

---

## Support Resources

- **Technical Docs**: `HIERARCHICAL_RBAC_GUIDE.md`
- **API Docs**: `API_IMPLEMENTATION_REFERENCE.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`
- **Code**: Check inline comments in auth files

---

## Version History

- **v1.0** - Initial hierarchical RBAC system
  - 3-tier role hierarchy
  - Team-based organization
  - Comprehensive API
  - Admin dashboards
  - Complete audit logging

---

## Contact

For issues or questions:
1. Check documentation
2. Review error logs
3. Test with curl/Postman
4. Contact technical team

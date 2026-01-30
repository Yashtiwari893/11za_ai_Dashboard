# Hierarchical RBAC Deployment Guide

## Pre-Deployment Checklist

- [ ] All database migrations reviewed and tested
- [ ] Authorization middleware tested with various roles
- [ ] API endpoints tested with valid/invalid inputs
- [ ] Frontend dashboards display correctly
- [ ] Audit logging working properly
- [ ] RLS policies verified
- [ ] Error handling comprehensive
- [ ] Documentation updated
- [ ] Load testing completed
- [ ] Security review passed

---

## Deployment Steps

### Phase 1: Database Setup (5 minutes)

#### 1.1 Create Backup
```bash
# Backup current database before migration
pg_dump -U postgres chatbot_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 1.2 Run Migration
```bash
# Apply hierarchical teams schema
psql -U postgres -d chatbot_db -f migrations/add_hierarchical_teams_schema.sql
```

#### 1.3 Verify Migration
```sql
-- Check new tables exist
SELECT * FROM information_schema.tables 
WHERE table_name IN ('teams', 'team_members', 'team_audit_log');

-- Check RLS is enabled
SELECT * FROM pg_tables 
WHERE tablename IN ('teams', 'team_members', 'team_audit_log');
```

---

### Phase 2: Initial Data Setup (10 minutes)

#### 2.1 Create Super Admin (if needed)
```sql
-- Find an existing admin user
SELECT id, email, role FROM user_profiles WHERE role = 'admin' LIMIT 1;

-- Update to super_admin
UPDATE user_profiles
SET role = 'super_admin'
WHERE id = 'your-admin-uuid'
AND status = 'active';

-- Verify
SELECT id, email, role FROM user_profiles WHERE role = 'super_admin';
```

#### 2.2 Create Initial Team
```sql
-- Create first team
INSERT INTO teams (id, name, description, status, created_by)
VALUES (
  gen_random_uuid(),
  'Main Team',
  'Primary team for all users',
  'active',
  'your-super-admin-uuid'
);

-- Verify
SELECT * FROM teams LIMIT 1;
```

#### 2.3 Verify RLS Policies
```sql
-- Check RLS policies are installed
SELECT policyname, tablename FROM pg_policies 
WHERE tablename IN ('teams', 'team_members');
```

---

### Phase 3: Backend Deployment (15 minutes)

#### 3.1 Deploy Code
```bash
# Build the application
npm run build

# Check for build errors
echo "Build completed successfully"
```

#### 3.2 Test API Endpoints
```bash
# Start local server
npm run dev

# In another terminal, test authentication
curl http://localhost:3000/api/super-admin/teams \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"

# Should return teams list or 401 error
```

#### 3.3 Verify Authorization Middleware
```typescript
// Quick test in browser console
fetch('/api/super-admin/teams')
  .then(r => r.json())
  .then(d => console.log('Response:', d))
  .catch(e => console.error('Error:', e))
```

---

### Phase 4: Frontend Deployment (10 minutes)

#### 4.1 Update Routes
Ensure these routes are accessible:
- `/super-admin` → Super Admin Dashboard
- `/admin` → Admin Dashboard
- `/user` → User Dashboard

#### 4.2 Test Navigation
1. Login as Super Admin
   - Should see `/super-admin` dashboard
   - Should see create admin/team forms
   
2. Login as Admin
   - Should see `/admin` dashboard
   - Should see team management

3. Login as User
   - Should see `/user` dashboard
   - Should see teams (read-only)

#### 4.3 Verify Components Load
```bash
# Check for any console errors
# Verify API calls return data
# Check loading states work
```

---

### Phase 5: Data Validation (10 minutes)

#### 5.1 Verify Role Hierarchy
```sql
-- Check role distribution
SELECT 
  role, 
  COUNT(*) as count
FROM user_profiles
GROUP BY role;

-- Expected output:
-- super_admin | 1
-- admin | X
-- team_admin | Y
-- user | Z
```

#### 5.2 Check Team Assignments
```sql
-- Verify teams have members
SELECT 
  t.name,
  COUNT(tm.id) as member_count
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id, t.name;
```

#### 5.3 Test RLS Policies
```sql
-- As authenticated user, verify you can only see your teams
-- This requires testing through app, not direct SQL

-- Check audit log entries exist
SELECT COUNT(*) FROM team_audit_log;
```

---

### Phase 6: Performance Testing (15 minutes)

#### 6.1 Load Test Key Endpoints
```bash
# Using Apache Bench (install: brew install httpd)
ab -n 100 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/super-admin/teams

# Expected: < 500ms response time
```

#### 6.2 Monitor Database Queries
```sql
-- Check slow queries
SELECT query, calls, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### 6.3 Verify Indexes
```sql
-- Check indexes exist
SELECT * FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('teams', 'team_members');
```

---

### Phase 7: Security Review (20 minutes)

#### 7.1 Verify Authentication
- [ ] All endpoints require authentication
- [ ] Invalid tokens rejected
- [ ] Session timeout works
- [ ] CORS properly configured

#### 7.2 Test Authorization
- [ ] Non-super-admin cannot create admins
- [ ] Team members can only see their teams
- [ ] Users cannot modify other users' data
- [ ] Role-based access enforced

#### 7.3 Check Audit Logging
```sql
-- Verify audit entries are created
SELECT 
  action,
  COUNT(*) as count
FROM team_audit_log
GROUP BY action;

-- Expected: entries for team_created, member_added, etc.
```

#### 7.4 SQL Injection Testing
```typescript
// Test with malicious input
const maliciousInput = "'; DROP TABLE teams; --";

// Should be safely escaped
// No actual drop should occur
```

---

### Phase 8: User Communication (30 minutes)

#### 8.1 Update Documentation
- Update system README with RBAC info
- Add quick start guide for admins
- Document role permissions
- Create troubleshooting guide

#### 8.2 Train Team Leads
- How to create teams
- How to assign members
- How to view audit logs
- How to troubleshoot common issues

#### 8.3 Notify Users
Send announcement:
```
Subject: New Role-Based Access Control System

We've upgraded our access control system with:
- Hierarchical roles (Super Admin > Admin > User)
- Team-based organization
- Comprehensive audit logging

What this means for you:
- Admins can manage their teams
- Team members are clearly defined
- All changes are logged
- Better security and organization

No action needed - your access remains the same.
Questions? See the new documentation or contact support.
```

---

## Post-Deployment Validation

### Monitor for 24 Hours

#### 8.1 System Monitoring
```bash
# Check error logs
tail -f logs/error.log

# Look for:
# - 401/403 errors (auth/auth issues)
# - 500 errors (server errors)
# - Database connection issues
```

#### 8.2 Performance Monitoring
```bash
# Check response times
# Monitor database CPU usage
# Monitor memory usage
# Expected: < 5% increase from baseline
```

#### 8.3 User Reports
- Monitor support tickets
- Track error reports
- Verify features work as expected
- Collect feedback

---

## Rollback Procedure

If issues occur, rollback with:

### Option 1: Database Rollback (Recommended)
```bash
# Restore from backup
psql -U postgres -d chatbot_db < backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
psql -U postgres -d chatbot_db -c "SELECT COUNT(*) FROM user_profiles;"
```

### Option 2: Code Rollback
```bash
# If code issue, deploy previous version
git checkout previous-version
npm run build
npm start
```

### Option 3: Data-Only Rollback (Keep DB changes)
If only code has issues:
```bash
# Deploy previous code
# Database stays with new schema
# May need to update role values manually
```

---

## Production Hardening

### 1. Enable Query Logging
```sql
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = ON;
ALTER SYSTEM SET log_min_duration_statement = 500;
SELECT pg_reload_conf();
```

### 2. Set Up Monitoring
```bash
# Database monitoring
- Connection count
- Query duration
- Slow queries
- Cache hit ratio

# Application monitoring
- Request/response time
- Error rate
- Role distribution
- Audit log growth
```

### 3. Configure Backups
```bash
# Daily backups
0 2 * * * pg_dump -U postgres chatbot_db | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Keep last 30 days
find /backups -name "db_*.sql.gz" -mtime +30 -delete
```

### 4. Set Up Alerts
```
- 401 error rate > 5%/min → Alert
- 403 error rate > 2%/min → Alert
- Response time > 1s → Alert
- Audit log insertion failure → Alert
- Database connection pool exhausted → Alert
```

---

## Maintenance Tasks

### Weekly
- [ ] Check error logs
- [ ] Review slow query log
- [ ] Verify backups completed
- [ ] Check role distribution hasn't changed unexpectedly

### Monthly
- [ ] Analyze query performance
- [ ] Review audit log for anomalies
- [ ] Update documentation as needed
- [ ] Security audit

### Quarterly
- [ ] Archive audit logs older than 90 days
- [ ] Review and optimize RLS policies
- [ ] Test disaster recovery procedure
- [ ] Performance baseline comparison

---

## Common Issues & Solutions

### Issue: "FORBIDDEN" errors for team members
**Solution**:
1. Verify user in team_members table
2. Check user has correct team role
3. Add user through Admin Dashboard

### Issue: Audit logs not recording
**Solution**:
1. Check RLS policies enabled
2. Verify actor_id = current user
3. Check disk space

### Issue: Slow team member queries
**Solution**:
1. Create indexes: `CREATE INDEX idx_team_members_team_id ON team_members(team_id);`
2. Analyze query: `EXPLAIN ANALYZE SELECT ...`
3. Consider caching

### Issue: Role not updating
**Solution**:
1. Verify UPDATE permissions
2. Check value is valid role
3. Restart application after DB change

---

## Success Criteria

Deployment is successful when:

✅ All 11 API endpoints responding correctly
✅ Role hierarchy enforced at all layers
✅ Audit logging all team actions
✅ RLS policies working
✅ Dashboards loading for correct roles
✅ Error rates < 1%
✅ Response times < 500ms
✅ Users can complete workflows
✅ Documentation updated
✅ Team trained and ready

---

## Support & Escalation

### First Escalation (30 min response)
- Database team
- Backend development team

### Second Escalation (2 hour response)
- DevOps team
- Architecture review

### Emergency Contact
- On-call engineer
- CTO/Tech lead

---

## Post-Deployment Review Meeting

Schedule after 1 week of production use:

**Agenda**:
1. Review error logs and metrics
2. Gather user feedback
3. Identify any issues
4. Plan improvements
5. Document lessons learned

-- =========================================
-- HIERARCHICAL ROLE SYSTEM WITH TEAMS
-- =========================================
-- Extends existing RBAC with:
-- - Hierarchical roles (SUPER_ADMIN, ADMIN, USER)
-- - Team management
-- - User-to-team assignments
-- - Team-based authorization

-- =========================================
-- 1. UPDATE USER_ROLES TABLE
-- =========================================

-- Add new roles (super_admin)
INSERT INTO user_roles (role_name, description) VALUES
  ('super_admin', 'Super administrator with full system and team management access'),
  ('team_admin', 'Team administrator can manage team members and team data')
ON CONFLICT (role_name) DO NOTHING;

-- =========================================
-- 2. TEAMS TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 3. TEAM MEMBERS TABLE
-- =========================================

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique team membership
  UNIQUE(team_id, user_id)
);

-- =========================================
-- 4. TEAM AUDIT LOG
-- =========================================

CREATE TABLE IF NOT EXISTS team_audit_log (
  id BIGSERIAL PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'team_created', 'team_updated', 'team_deleted',
    'member_added', 'member_removed', 'member_role_changed'
  )),
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 5. INDEXES FOR PERFORMANCE
-- =========================================

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_team_id ON team_audit_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_admin_id ON team_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_created_at ON team_audit_log(created_at DESC);

-- =========================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =========================================

-- Enable RLS on team tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_audit_log ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TEAMS RLS POLICIES
-- =========================================

-- Policy 1: SUPER_ADMIN can view all teams
CREATE POLICY "SUPER_ADMIN can view all teams" ON teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 2: Team members can view their teams
CREATE POLICY "Team members can view their teams" ON teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = auth.uid()
    )
  );

-- Policy 3: SUPER_ADMIN can create teams
CREATE POLICY "SUPER_ADMIN can create teams" ON teams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 4: SUPER_ADMIN can update teams
CREATE POLICY "SUPER_ADMIN can update teams" ON teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 5: Team owners/admins can update their teams
CREATE POLICY "Team owners and admins can update their teams" ON teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- =========================================
-- TEAM_MEMBERS RLS POLICIES
-- =========================================

-- Policy 1: SUPER_ADMIN can view all team members
CREATE POLICY "SUPER_ADMIN can view all team members" ON team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 2: Team members can view their team members
CREATE POLICY "Team members can view their team" ON team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid()
    )
  );

-- Policy 3: SUPER_ADMIN can manage team members
CREATE POLICY "SUPER_ADMIN can manage team members" ON team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 4: Team owners can manage team members
CREATE POLICY "Team owners can add members" ON team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id 
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Policy 5: SUPER_ADMIN can delete team members
CREATE POLICY "SUPER_ADMIN can remove team members" ON team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 6: Team owners can remove team members
CREATE POLICY "Team owners can remove members" ON team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id 
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- =========================================
-- TEAM_AUDIT_LOG RLS POLICIES
-- =========================================

-- Policy 1: SUPER_ADMIN can view all audit logs
CREATE POLICY "SUPER_ADMIN can view audit logs" ON team_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 2: Team admins can view their team audit logs
CREATE POLICY "Team admins can view team audit logs" ON team_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_audit_log.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policy 3: System can insert audit logs
CREATE POLICY "System can insert audit logs" ON team_audit_log
  FOR INSERT
  WITH CHECK (true);

-- =========================================
-- 7. HELPER FUNCTIONS
-- =========================================

-- Get user's role in a specific team
CREATE OR REPLACE FUNCTION get_user_team_role(p_user_id UUID, p_team_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM team_members 
  WHERE user_id = p_user_id AND team_id = p_team_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get all teams for a user
CREATE OR REPLACE FUNCTION get_user_teams(p_user_id UUID)
RETURNS TABLE(team_id UUID, team_name TEXT, user_role TEXT) AS $$
  SELECT tm.team_id, t.name, tm.role
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role FROM user_profiles WHERE id = p_user_id) = 'super_admin', false);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user can manage team
CREATE OR REPLACE FUNCTION can_manage_team(p_user_id UUID, p_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT 
    CASE 
      WHEN is_super_admin(p_user_id) THEN true
      ELSE EXISTS (
        SELECT 1 FROM team_members
        WHERE user_id = p_user_id 
        AND team_id = p_team_id
        AND role IN ('owner', 'admin')
      )
    END;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =========================================
-- 8. TRIGGERS
-- =========================================

-- Update timestamp on teams
CREATE OR REPLACE FUNCTION update_teams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_teams_timestamp_trigger ON teams;
CREATE TRIGGER update_teams_timestamp_trigger
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_timestamp();

-- =========================================
-- 9. DOCUMENTATION
-- =========================================

COMMENT ON TABLE teams IS 'Represents a team/organization unit that admins manage';
COMMENT ON TABLE team_members IS 'Links users to teams with their role in that team';
COMMENT ON TABLE team_audit_log IS 'Audit trail for all team-related actions';
COMMENT ON COLUMN teams.status IS 'Team status: active, inactive, or archived';
COMMENT ON COLUMN team_members.role IS 'User role in team: owner, admin, or member';
COMMENT ON FUNCTION get_user_team_role IS 'Get specific user role in a team';
COMMENT ON FUNCTION get_user_teams IS 'Get all teams a user is member of';
COMMENT ON FUNCTION is_super_admin IS 'Check if user has super_admin role';
COMMENT ON FUNCTION can_manage_team IS 'Check if user can manage a specific team';

-- =========================================
-- ROLE-BASED ACCESS CONTROL (RBAC) Schema
-- =========================================
-- Implements ADMIN and USER role system with data isolation

-- 1. User Roles Enumeration Table
-- Stores all available roles in the system
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (role_name, description) VALUES
  ('admin', 'Administrator with full system access'),
  ('user', 'Regular user with own data access only')
ON CONFLICT (role_name) DO NOTHING;

-- 2. User Profiles Table
-- Extended user information linked to Supabase auth.users
-- This is the bridge table between Supabase auth and our application
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' REFERENCES user_roles(role_name),
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified_email BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. User Metadata Log Table
-- Audit trail for admin actions on users
CREATE TABLE IF NOT EXISTS user_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('activate', 'deactivate', 'role_change', 'data_edit', 'view')),
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON user_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_user_id ON user_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON user_audit_log(created_at DESC);

-- =========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view all user profiles
CREATE POLICY "Admins can view all user profiles" ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 2: Users can view only their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Policy 3: Admins can update any user profile
CREATE POLICY "Admins can update user profiles" ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 4: Users can update only their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Prevent users from changing their role
    role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

-- Policy 5: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON user_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 6: Audit logs are insert-only for application
CREATE POLICY "System can insert audit logs" ON user_audit_log
  FOR INSERT
  WITH CHECK (true);

-- =========================================
-- HELPER FUNCTIONS
-- =========================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role FROM user_profiles WHERE id = user_id) = 'admin', false);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to check if user is active
CREATE OR REPLACE FUNCTION is_user_active(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_active FROM user_profiles WHERE id = user_id), false);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =========================================
-- TRIGGERS
-- =========================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_timestamp_trigger ON user_profiles;
CREATE TRIGGER update_user_profiles_timestamp_trigger
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_timestamp();

-- =========================================
-- Comments for Documentation
-- =========================================

COMMENT ON TABLE user_profiles IS 'Extended user information with role management';
COMMENT ON TABLE user_roles IS 'Available roles in the system';
COMMENT ON TABLE user_audit_log IS 'Audit trail for admin actions and user access';
COMMENT ON COLUMN user_profiles.role IS 'User role: admin or user';
COMMENT ON COLUMN user_profiles.is_active IS 'Whether user account is active (admin can deactivate)';
COMMENT ON FUNCTION get_user_role IS 'Get role of a specific user';
COMMENT ON FUNCTION is_user_admin IS 'Check if user has admin role';
COMMENT ON FUNCTION is_user_active IS 'Check if user account is active';

'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Edit2, Check, X } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

/**
 * ============================================
 * USER DASHBOARD
 * ============================================
 * 
 * Secure user interface to:
 * - View own profile information
 * - Edit personal details (name, phone)
 * - Cannot edit: email, role, status
 */
function UserDashboard() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile> | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch user profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const result = await response.json();
      if (result.success) {
        setProfile(result.data);
        setEditData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const handleUpdateProfile = async () => {
    if (!editData) return;

    try {
      setSaving(true);
      setError(null);

      const updatePayload: any = {};

      if (editData.full_name !== profile?.full_name) {
        updatePayload.full_name = editData.full_name;
      }

      if (editData.phone_number !== profile?.phone_number) {
        updatePayload.phone_number = editData.phone_number;
      }

      if (Object.keys(updatePayload).length === 0) {
        setIsEditing(false);
        return;
      }

      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await response.json();
      if (result.success) {
        setProfile(result.data.profile);
        setIsEditing(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your profile and account settings</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Logout
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Profile Information</CardTitle>
                <CardDescription>View and manage your account details</CardDescription>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <Label className="text-sm font-medium text-gray-600">Email Address</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 font-medium">{profile?.email}</p>
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
            </div>

            {/* Role (Read-only) */}
            <div>
              <Label className="text-sm font-medium text-gray-600">Account Role</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 font-medium capitalize">{profile?.role}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.role === 'admin'
                    ? 'You have administrator access to the system'
                    : 'You have regular user access'}
                </p>
              </div>
            </div>

            {/* Status (Read-only) */}
            <div>
              <Label className="text-sm font-medium text-gray-600">Account Status</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${
                    profile?.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </span>
                {!profile?.is_active && (
                  <p className="text-xs text-red-600 mt-2">
                    Your account has been deactivated by an administrator.
                  </p>
                )}
              </div>
            </div>

            {/* Full Name (Editable) */}
            <div>
              <Label
                htmlFor="fullName"
                className="text-sm font-medium text-gray-600"
              >
                Full Name
              </Label>
              {isEditing ? (
                <Input
                  id="fullName"
                  value={editData?.full_name || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      full_name: e.target.value,
                    })
                  }
                  placeholder="Enter your full name"
                  className="mt-2"
                />
              ) : (
                <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-900 font-medium">
                    {profile?.full_name || 'Not provided'}
                  </p>
                </div>
              )}
            </div>

            {/* Phone Number (Editable) */}
            <div>
              <Label
                htmlFor="phoneNumber"
                className="text-sm font-medium text-gray-600"
              >
                Phone Number
              </Label>
              {isEditing ? (
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={editData?.phone_number || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      phone_number: e.target.value,
                    })
                  }
                  placeholder="Enter your phone number"
                  className="mt-2"
                />
              ) : (
                <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-900 font-medium">
                    {profile?.phone_number || 'Not provided'}
                  </p>
                </div>
              )}
            </div>

            {/* Created At (Read-only) */}
            <div>
              <Label className="text-sm font-medium text-gray-600">Account Created</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 font-medium">
                  {new Date(profile?.created_at || '').toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Last Login (Read-only) */}
            {profile?.last_login && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Last Login</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-900 font-medium">
                    {new Date(profile.last_login).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData(profile);
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateProfile}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900">
                  <strong>Privacy Notice:</strong> Your data is isolated and only visible to you
                  (or administrators). We never share your information without consent.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function UserDashboardWrapper() {
  return (
    <ProtectedRoute requiredRole={['user', 'admin', 'team_admin', 'super_admin']}>
      <UserDashboard />
    </ProtectedRoute>
  );
}

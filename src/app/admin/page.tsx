'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  userRole: string;
  teamRole: 'member' | 'admin' | 'owner';
  joinedAt: string;
}

function AdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);

  // Add member states
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    userId: '',
    role: 'member',
  });
  const [addMemberError, setAddMemberError] = useState('');
  const [addMemberSuccess, setAddMemberSuccess] = useState('');

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!['admin', 'team_admin'].includes(profile?.role)) {
        router.push('/');
        return;
      }

      setUserRole(profile?.role || '');
      setLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  // Fetch teams
  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/super-admin/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(data.data || []);

      // Auto-select first team
      if ((data.data || []).length > 0) {
        loadTeamMembers(data.data[0]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  // Load team members
  const loadTeamMembers = async (team: Team) => {
    setSelectedTeam(team);
    setTeamMembersLoading(true);

    try {
      const response = await fetch(`/api/admin/teams/${team.id}/members`);
      if (!response.ok) throw new Error('Failed to fetch team members');
      const data = await response.json();
      setTeamMembers(data.data.members || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  // Add member to team
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    setAddMemberError('');
    setAddMemberSuccess('');
    setAddMemberLoading(true);

    try {
      const response = await fetch(
        `/api/admin/teams/${selectedTeam.id}/assign-user`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: addMemberForm.userId,
            role: addMemberForm.role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setAddMemberError(data.error || 'Failed to add member');
        return;
      }

      setAddMemberSuccess('Member added successfully');
      setAddMemberForm({ userId: '', role: 'member' });

      setTimeout(() => {
        loadTeamMembers(selectedTeam);
        setAddMemberOpen(false);
      }, 1500);
    } catch (error: any) {
      setAddMemberError(error.message || 'An error occurred');
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Remove member from team
  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam || !confirm('Remove this member from the team?')) return;

    try {
      const response = await fetch(
        `/api/admin/teams/${selectedTeam.id}/remove-user`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) throw new Error('Failed to remove member');
      loadTeamMembers(selectedTeam);
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  // Initial load
  useEffect(() => {
    if (!loading) {
      fetchTeams();
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600 mt-2">
            {userRole === 'team_admin'
              ? 'Manage your team and members'
              : 'Manage teams and system users'}
          </p>
        </div>

        {/* Teams Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Your Teams</CardTitle>
              <CardDescription>{teams.length} teams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teams.map((team) => (
                  <Button
                    key={team.id}
                    variant={
                      selectedTeam?.id === team.id ? 'default' : 'outline'
                    }
                    className="w-full justify-start"
                    onClick={() => loadTeamMembers(team)}
                  >
                    <div className="text-left">
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-xs opacity-75">{team.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Details */}
          <div className="lg:col-span-2">
            {selectedTeam ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedTeam.name}</CardTitle>
                      <CardDescription>
                        {selectedTeam.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Team Member</DialogTitle>
                          <DialogDescription>
                            Assign a user to {selectedTeam.name}
                          </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleAddMember} className="space-y-4">
                          <Input
                            placeholder="User ID"
                            value={addMemberForm.userId}
                            onChange={(e) =>
                              setAddMemberForm({
                                ...addMemberForm,
                                userId: e.target.value,
                              })
                            }
                            required
                          />
                          <Select
                            value={addMemberForm.role}
                            onValueChange={(value) =>
                              setAddMemberForm({
                                ...addMemberForm,
                                role: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>

                          {addMemberError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                              {addMemberError}
                            </div>
                          )}
                          {addMemberSuccess && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                              {addMemberSuccess}
                            </div>
                          )}

                          <Button
                            type="submit"
                            className="w-full"
                            disabled={addMemberLoading}
                          >
                            {addMemberLoading && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Add Member
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {teamMembersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamMembers.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell className="font-mono text-sm">
                                {member.email}
                              </TableCell>
                              <TableCell>{member.fullName || '-'}</TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                  {member.teamRole}
                                </span>
                              </TableCell>
                              <TableCell>
                                {new Date(member.joinedAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveMember(member.userId)
                                  }
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-slate-600">
                    <p>No teams available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPageWrapper() {
  return (
    <ProtectedRoute requiredRole={['admin', 'team_admin']}>
      <AdminPage />
    </ProtectedRoute>
  );
}

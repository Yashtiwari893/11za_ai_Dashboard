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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';

interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'team_admin';
  status: 'active' | 'inactive';
  teams: Array<{ teamId: string; teamName: string; role: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
}

interface TeamMember {
  userId: string;
  email: string;
  fullName: string;
  userRole: string;
  teamRole: 'member' | 'admin' | 'owner';
  joinedAt: string;
}

function SuperAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState('admins');

  // Create Admin form states
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [createAdminForm, setCreateAdminForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'admin',
    teamIds: [] as string[],
  });
  const [createAdminError, setCreateAdminError] = useState('');
  const [createAdminSuccess, setCreateAdminSuccess] = useState('');

  // Create Team form states
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTeamLoading, setCreateTeamLoading] = useState(false);
  const [createTeamForm, setCreateTeamForm] = useState({
    name: '',
    description: '',
  });
  const [createTeamError, setCreateTeamError] = useState('');
  const [createTeamSuccess, setCreateTeamSuccess] = useState('');

  // Manage Team Members states
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [assignMemberOpen, setAssignMemberOpen] = useState(false);
  const [assignMemberForm, setAssignMemberForm] = useState({
    userId: '',
    role: 'member',
  });

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

      // Verify user is super admin
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'super_admin') {
        router.push('/');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  // Fetch admins
  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/super-admin/admins');
      if (!response.ok) throw new Error('Failed to fetch admins');
      const data = await response.json();
      setAdmins(data.data.admins || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  // Fetch teams
  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/super-admin/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(data.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (!loading) {
      fetchAdmins();
      fetchTeams();
    }
  }, [loading]);

  // Create admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAdminError('');
    setCreateAdminSuccess('');
    setCreateAdminLoading(true);

    try {
      const response = await fetch('/api/super-admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createAdminForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateAdminError(data.error || 'Failed to create admin');
        return;
      }

      setCreateAdminSuccess('Admin created successfully');
      setCreateAdminForm({
        email: '',
        password: '',
        fullName: '',
        role: 'admin',
        teamIds: [],
      });

      // Refresh admins list
      setTimeout(() => {
        fetchAdmins();
        setCreateAdminOpen(false);
      }, 1500);
    } catch (error: any) {
      setCreateAdminError(error.message || 'An error occurred');
    } finally {
      setCreateAdminLoading(false);
    }
  };

  // Create team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTeamError('');
    setCreateTeamSuccess('');
    setCreateTeamLoading(true);

    try {
      const response = await fetch('/api/super-admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTeamForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateTeamError(data.error || 'Failed to create team');
        return;
      }

      setCreateTeamSuccess('Team created successfully');
      setCreateTeamForm({ name: '', description: '' });

      // Refresh teams list
      setTimeout(() => {
        fetchTeams();
        setCreateTeamOpen(false);
      }, 1500);
    } catch (error: any) {
      setCreateTeamError(error.message || 'An error occurred');
    } finally {
      setCreateTeamLoading(false);
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

  // Delete admin
  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to deactivate this admin?')) return;

    try {
      const response = await fetch(`/api/super-admin/admins/${adminId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete admin');
      fetchAdmins();
    } catch (error) {
      console.error('Error deleting admin:', error);
      alert('Failed to delete admin');
    }
  };

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
          <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard</h1>
          <p className="text-slate-600 mt-2">Manage admins, teams, and system configuration</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          {/* Admins Tab */}
          <TabsContent value="admins" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Manage Admins</h2>
              <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Admin</DialogTitle>
                    <DialogDescription>
                      Create a new admin user with team assignments
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateAdmin} className="space-y-4">
                    <Input
                      placeholder="Email"
                      type="email"
                      value={createAdminForm.email}
                      onChange={(e) =>
                        setCreateAdminForm({
                          ...createAdminForm,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                    <Input
                      placeholder="Full Name"
                      value={createAdminForm.fullName}
                      onChange={(e) =>
                        setCreateAdminForm({
                          ...createAdminForm,
                          fullName: e.target.value,
                        })
                      }
                      required
                    />
                    <Input
                      placeholder="Password"
                      type="password"
                      value={createAdminForm.password}
                      onChange={(e) =>
                        setCreateAdminForm({
                          ...createAdminForm,
                          password: e.target.value,
                        })
                      }
                      required
                    />
                    <Select
                      value={createAdminForm.role}
                      onValueChange={(value) =>
                        setCreateAdminForm({
                          ...createAdminForm,
                          role: value as 'admin' | 'team_admin',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin (All Teams)</SelectItem>
                        <SelectItem value="team_admin">Team Admin (Specific Teams)</SelectItem>
                      </SelectContent>
                    </Select>

                    {createAdminError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {createAdminError}
                      </div>
                    )}
                    {createAdminSuccess && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                        {createAdminSuccess}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={createAdminLoading}>
                      {createAdminLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Admin
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Admins Table */}
            <Card>
              <CardHeader>
                <CardTitle>System Admins ({admins.length})</CardTitle>
                <CardDescription>
                  Manage admin users and their permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Teams</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admins.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell className="font-mono text-sm">{admin.email}</TableCell>
                          <TableCell>{admin.fullName || '-'}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {admin.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                admin.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {admin.status}
                            </span>
                          </TableCell>
                          <TableCell>{admin.teams.length}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAdmin(admin.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Manage Teams</h2>
              <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                    <DialogDescription>
                      Create a new team for organizing users
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <Input
                      placeholder="Team Name"
                      value={createTeamForm.name}
                      onChange={(e) =>
                        setCreateTeamForm({
                          ...createTeamForm,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={createTeamForm.description}
                      onChange={(e) =>
                        setCreateTeamForm({
                          ...createTeamForm,
                          description: e.target.value,
                        })
                      }
                    />

                    {createTeamError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {createTeamError}
                      </div>
                    )}
                    {createTeamSuccess && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                        {createTeamSuccess}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={createTeamLoading}>
                      {createTeamLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Team
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => loadTeamMembers(team)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription>{team.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-600">Status: </span>
                        <span
                          className={
                            team.status === 'active'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {team.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600">Created: </span>
                        <span>
                          {new Date(team.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Team Members Detail */}
            {selectedTeam && (
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Team Members: {selectedTeam.name}</CardTitle>
                      <CardDescription>
                        {teamMembers.length} members in this team
                      </CardDescription>
                    </div>
                    <Dialog open={assignMemberOpen} onOpenChange={setAssignMemberOpen}>
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
                            Add an existing user to the team
                          </DialogDescription>
                        </DialogHeader>
                        {/* TODO: Implement member assignment form */}
                        <div className="text-sm text-slate-600">
                          Member assignment form coming soon
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {teamMembersLoading ? (
                    <div className="flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>User Role</TableHead>
                            <TableHead>Team Role</TableHead>
                            <TableHead>Joined</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamMembers.map((member) => (
                            <TableRow key={member.userId}>
                              <TableCell className="font-mono text-sm">
                                {member.email}
                              </TableCell>
                              <TableCell>{member.fullName || '-'}</TableCell>
                              <TableCell>{member.userRole}</TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                  {member.teamRole}
                                </span>
                              </TableCell>
                              <TableCell>
                                {new Date(member.joinedAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SuperAdminPageWrapper() {
  return (
    <ProtectedRoute requiredRole={['super_admin']}>
      <SuperAdminPage />
    </ProtectedRoute>
  );
}

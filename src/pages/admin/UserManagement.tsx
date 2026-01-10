import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Ban, CheckCircle, Shield } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  division: string | null;
  district: string | null;
  is_blocked: boolean | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

export default function UserManagement() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isAdmin === false) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      fetchUsers();
    }
  }, [user, isAdmin]);

  const fetchUsers = async () => {
    setIsLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    setProfiles(profilesRes.data || []);
    setUserRoles(rolesRes.data || []);
    setIsLoading(false);
  };

  const toggleBlock = async (profile: Profile) => {
    const newBlockedStatus = !profile.is_blocked;
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: newBlockedStatus })
      .eq('id', profile.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update user status', variant: 'destructive' });
    } else {
      toast({ 
        title: 'Success', 
        description: newBlockedStatus ? 'User blocked' : 'User unblocked' 
      });
      fetchUsers();
    }
  };

  const isUserAdmin = (userId: string) => {
    return userRoles.some(r => r.user_id === userId && r.role === 'admin');
  };

  const filteredProfiles = profiles.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(query) ||
      p.phone_number?.includes(query) ||
      p.division?.toLowerCase().includes(query) ||
      p.district?.toLowerCase().includes(query)
    );
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-64 w-64" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage all registered users</p>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name, phone, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProfiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {profile.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {profile.full_name || 'Unknown User'}
                      </h3>
                      {isUserAdmin(profile.user_id) && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                      {profile.is_blocked && (
                        <Badge variant="destructive">Blocked</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {profile.phone_number && <span>{profile.phone_number}</span>}
                      {profile.district && profile.division && (
                        <span>{profile.district}, {profile.division}</span>
                      )}
                      <span>Joined: {new Date(profile.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Button
                    variant={profile.is_blocked ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => toggleBlock(profile)}
                    disabled={isUserAdmin(profile.user_id)}
                  >
                    {profile.is_blocked ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Unblock
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4 mr-1" />
                        Block
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

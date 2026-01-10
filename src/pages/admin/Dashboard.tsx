import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  FileCheck, 
  FileClock, 
  FileX, 
  AlertTriangle,
  LayoutDashboard,
  FileText,
  FolderTree,
  Flag,
  LogOut
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Stats {
  totalUsers: number;
  pendingAds: number;
  approvedAds: number;
  rejectedAds: number;
  pendingReports: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      fetchStats();
    }
  }, [user, isAdmin, navigate]);

  const fetchStats = async () => {
    setIsLoading(true);
    
    const [usersRes, pendingRes, approvedRes, rejectedRes, reportsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('ads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('ads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('ads').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
    ]);

    setStats({
      totalUsers: usersRes.count || 0,
      pendingAds: pendingRes.count || 0,
      approvedAds: approvedRes.count || 0,
      rejectedAds: rejectedRes.count || 0,
      pendingReports: reportsRes.count || 0,
    });
    setIsLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-64 w-64" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Users', value: stats?.totalUsers, icon: Users, color: 'text-blue-500' },
    { title: 'Pending Ads', value: stats?.pendingAds, icon: FileClock, color: 'text-yellow-500' },
    { title: 'Approved Ads', value: stats?.approvedAds, icon: FileCheck, color: 'text-green-500' },
    { title: 'Rejected Ads', value: stats?.rejectedAds, icon: FileX, color: 'text-red-500' },
    { title: 'Pending Reports', value: stats?.pendingReports, icon: AlertTriangle, color: 'text-orange-500' },
  ];

  const navItems = [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { title: 'Ad Moderation', href: '/admin/ads', icon: FileText },
    { title: 'Categories', href: '/admin/categories', icon: FolderTree },
    { title: 'Users', href: '/admin/users', icon: Users },
    { title: 'Reports', href: '/admin/reports', icon: Flag },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-card border-r p-4">
          <div className="mb-8">
            <Link to="/" className="text-2xl font-bold text-primary">
              BazarBD
            </Link>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-8">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your marketplace</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stat.value}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/admin/ads')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileClock className="h-5 w-5 text-yellow-500" />
                  Review Pending Ads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {stats?.pendingAds || 0} ads waiting for review
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/admin/reports')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-orange-500" />
                  Handle Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {stats?.pendingReports || 0} reports to review
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/admin/categories')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5 text-blue-500" />
                  Manage Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add or edit categories and subcategories
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

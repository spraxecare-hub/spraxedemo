import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard,
  FileText,
  FolderTree,
  Users,
  Flag,
  LogOut,
  Home
} from 'lucide-react';

const navItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Ad Moderation', href: '/admin/ads', icon: FileText },
  { title: 'Categories', href: '/admin/categories', icon: FolderTree },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Reports', href: '/admin/reports', icon: Flag },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-card border-r p-4 flex flex-col">
          <div className="mb-8">
            <Link to="/" className="text-2xl font-bold text-primary">
              BazarBD
            </Link>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>
          
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-accent'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t space-y-2">
            <Link to="/">
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Home className="h-5 w-5" />
                Back to Site
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

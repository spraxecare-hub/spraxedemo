import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Check, ExternalLink, Trash2, Calendar, Flag } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Report {
  id: string;
  reason: string;
  is_resolved: boolean;
  created_at: string;
  ads: {
    id: string;
    title: string;
    slug: string;
    status: string;
  } | null;
  profiles: {
    full_name: string | null;
  } | null;
}

export default function ReportManagement() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

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
      fetchReports();
    }
  }, [user, isAdmin, activeTab]);

  const fetchReports = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        ads(id, title, slug, status)
      `)
      .eq('is_resolved', activeTab === 'resolved')
      .order('created_at', { ascending: false });

    // Fetch profiles separately for each report
    if (data) {
      const reportsWithProfiles = await Promise.all(
        data.map(async (report) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', report.user_id)
            .single();
          return { ...report, profiles: profile };
        })
      );
      setReports(reportsWithProfiles as Report[]);
    } else {
      setReports([]);
    }
    setIsLoading(false);
  };

  const resolveReport = async (reportId: string) => {
    const { error } = await supabase
      .from('reports')
      .update({ is_resolved: true })
      .eq('id', reportId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve report', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Report marked as resolved' });
      fetchReports();
    }
  };

  const deleteAd = async (adId: string, reportId: string) => {
    if (!confirm('Delete this ad permanently?')) return;

    const { error } = await supabase.from('ads').delete().eq('id', adId);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete ad', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Ad deleted' });
      resolveReport(reportId);
    }
  };

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
        <h1 className="text-3xl font-bold">Report Management</h1>
        <p className="text-muted-foreground">Handle reported ads</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No {activeTab === 'pending' ? 'pending' : 'resolved'} reports.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Flag className="h-5 w-5 text-orange-500 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">
                              {report.ads?.title || 'Deleted Ad'}
                            </h3>
                            <Badge 
                              variant={report.ads?.status === 'approved' ? 'default' : 'secondary'}
                              className="mt-1"
                            >
                              {report.ads?.status || 'Unknown'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="mt-2 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            Reported by: {report.profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-sm">{report.reason}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {report.ads && (
                          <Link to={`/ad/${report.ads.slug}`} target="_blank">
                            <Button size="sm" variant="outline" className="w-full">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        )}
                        {activeTab === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => resolveReport(report.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                            {report.ads && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteAd(report.ads!.id, report.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete Ad
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

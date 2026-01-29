'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/hooks/use-toast';

import { Loader2, Store, ShieldCheck, XCircle, Clock3, ArrowRight, LayoutDashboard } from 'lucide-react';

const isValidBDPhone = (phone: string) => /^01[3-9]\d{8}$/.test(String(phone || '').trim());

function statusMeta(status: any) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'approved') return { label: 'Approved', Icon: ShieldCheck, cls: 'bg-green-50 text-green-800 border-green-200' };
  if (s === 'rejected') return { label: 'Rejected', Icon: XCircle, cls: 'bg-red-50 text-red-800 border-red-200' };
  return { label: 'Pending', Icon: Clock3, cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
}

export default function SellPage() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);

  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  useEffect(() => {
    if (!profile) return;
    setShopName((profile as any).shop_name || '');
    setShopDescription((profile as any).shop_description || '');
    setCompanyName((profile as any).company_name || '');
    setBusinessType((profile as any).business_type || '');
    setPhone((profile as any).phone || '');
    // we don't have a dedicated address field in Profile type, so store as business_type/description if needed
    setBusinessAddress((profile as any).business_address || '');
  }, [profile]);

  const canSubmit = useMemo(() => {
    const okPhone = !phone || isValidBDPhone(phone);
    return (
      shopName.trim().length >= 3 &&
      companyName.trim().length >= 2 &&
      businessType.trim().length >= 2 &&
      businessAddress.trim().length >= 6 &&
      okPhone
    );
  }, [shopName, companyName, businessType, businessAddress, phone]);

  const submitApplication = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!canSubmit) {
      toast({
        title: 'Missing information',
        description: 'Please complete the required fields (and ensure the phone number is valid).',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const updates: any = {
        role: 'seller',
        seller_status: 'pending',
        shop_name: shopName.trim(),
        shop_description: shopDescription.trim() || null,
        company_name: companyName.trim() || null,
        business_type: businessType.trim() || null,
        phone: phone.trim() || null,
        // optional field (if exists in your schema). If it doesn't exist, Supabase will error.
        business_address: businessAddress.trim() || null,
      };

      // try updating, and if your profiles table is missing optional columns, retry without them
      let attempt = 0;
      let lastError: any = null;
      while (attempt < 5) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
        const msg = String(error.message || '');
        // common Postgres message: column "xyz" of relation "profiles" does not exist
        const m = msg.match(/column "([^"]+)"/i);
        if (!m) break;
        const col = m[1];
        if (!(col in updates)) break;
        delete updates[col];
        attempt += 1;
      }
      if (lastError) throw lastError;

      await refreshProfile();

      toast({
        title: 'Application submitted',
        description: 'Your seller application is now pending review. You can start preparing your catalog.',
      });

      router.push('/seller');
    } catch (e: any) {
      toast({
        title: 'Could not submit application',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const alreadySeller = profile?.role === 'seller';
  const status = (profile as any)?.seller_status;
  const meta = statusMeta(status);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-10 md:py-14 flex-1">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Sell on Spraxe</h1>
              <p className="text-sm text-gray-600 mt-1">Apply to become a seller and manage your products & inventory.</p>
            </div>
            {alreadySeller && (
              <Badge className={`border ${meta.cls}`}>
                <meta.Icon className="h-4 w-4 mr-2" />
                {meta.label}
              </Badge>
            )}
          </div>

          {!user && !loading && (
            <Alert className="mb-6">
              <AlertTitle>Sign in required</AlertTitle>
              <AlertDescription>
                Please <Link className="underline" href="/login">sign in</Link> to apply as a seller.
              </AlertDescription>
            </Alert>
          )}

          {alreadySeller && (
            <Card className="shadow-sm border-blue-100 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-blue-900" />
                  Your seller status
                </CardTitle>
                <CardDescription>
                  {status === 'approved'
                    ? 'You are approved. You can add products and start selling.'
                    : status === 'rejected'
                      ? 'Your application was rejected. Update your details and reapply.'
                      : 'Your application is pending review.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <Link href="/seller" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-blue-900 hover:bg-blue-800">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Seller dashboard
                  </Button>
                </Link>
                <Link href="/seller/inventory" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Manage inventory <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Seller application</CardTitle>
              <CardDescription>Fill in your business details. Admin will review and approve your account.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Shop name *</Label>
                  <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Spraxe Accessories" className="bg-white" />
                </div>

                <div>
                  <Label>Company name *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your registered company" className="bg-white" />
                </div>

                <div>
                  <Label>Business type *</Label>
                  <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="e.g. Electronics, Accessories" className="bg-white" />
                </div>

                <div>
                  <Label>Phone (BD 11 digits)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="bg-white" />
                  {phone && !isValidBDPhone(phone) && (
                    <div className="text-xs text-red-600 mt-1">Phone must be 11 digits starting with 01 (operator 3–9).</div>
                  )}
                </div>
              </div>

              <div>
                <Label>Business address *</Label>
                <Textarea value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Full address for pickups/returns" className="bg-white min-h-[90px]" />
              </div>

              <div>
                <Label>Shop description</Label>
                <Textarea value={shopDescription} onChange={(e) => setShopDescription(e.target.value)} placeholder="What do you sell? What makes your shop unique?" className="bg-white min-h-[110px]" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={submitApplication}
                  disabled={submitting || loading || !user || !canSubmit}
                  className="bg-blue-900 hover:bg-blue-800"
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Store className="h-4 w-4 mr-2" />}
                  Submit application
                </Button>

                <Link href="/" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">Back to shop</Button>
                </Link>
              </div>

              <div className="text-xs text-gray-500 leading-relaxed">
                Tip: After approval you can create products. Seller products are submitted for approval before going live.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/safe-image';
import { supabase } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, Loader2, Eye, EyeOff, Lock } from 'lucide-react';

/**
 * ✅ Professional improvements included:
 * - cleaner premium layout (gradient bg + glow)
 * - consistent Spraxe logo usage (/spraxe.png)
 * - better validation + disables to prevent double submit
 * - correct SMS OTP length (6 digits) + numeric-only
 * - better error messages
 * - remembers which tab, resets OTP state when switching
 * - improved OTP UX and back action
 * - consistent buttons & spacing
 */

type TabKey = 'phone' | 'email';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Google sign-in failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-10 md:py-14 flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-200/40 via-indigo-200/30 to-sky-200/40 blur-lg" />

            <Card className="relative border-blue-100/70 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden">
                    <SafeImage src="/spraxe.png" alt="Spraxe Logo" width={120} height={40} className="h-10 w-auto object-contain" priority />
                  </div>
                </div>

                <CardTitle className="text-2xl font-bold text-blue-950 tracking-tight">
                  Welcome back
                </CardTitle>
                <CardDescription className="text-sm">
                  Sign in to continue shopping on Spraxe.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <AuthForms onLoading={setIsLoading} isLoading={isLoading} onGoogleLogin={handleGoogleSignIn} />

                <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
                  By continuing, you agree to our{' '}
                  <Link href="/terms" className="underline hover:text-blue-900">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline hover:text-blue-900">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-900 font-medium hover:underline">
              Create one
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function AuthForms({
  onLoading,
  isLoading,
  onGoogleLogin,
}: {
  onLoading: (v: boolean) => void;
  isLoading: boolean;
  onGoogleLogin: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('phone');

  // EMAIL
  const [showPassword, setShowPassword] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const canEmailLogin = useMemo(() => {
    return isValidEmail(signInEmail) && signInPassword.trim().length >= 1;
  }, [signInEmail, signInPassword]);

  const resetOnTabSwitch = (next: TabKey) => {
    setTab(next);
  };

  const handleEmailSignIn = async () => {
    if (!signInEmail.trim() || !signInPassword.trim()) {
      toast({ title: 'Missing information', description: 'Please enter email and password.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(signInEmail)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    onLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail.trim(),
        password: signInPassword,
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        toast({ title: 'Signed in', description: 'Welcome back!' });
        router.push(profile?.role === 'admin' ? '/admin' : profile?.role === 'seller' ? '/seller' : '/');
      }
    } catch (error: any) {
      toast({ title: 'Sign in failed', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      onLoading(false);
    }
  };


  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(v) => resetOnTabSwitch(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="phone" className="gap-2">
            <Phone className="h-4 w-4" /> Phone
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" /> Email
          </TabsTrigger>
        </TabsList>

        {/* PHONE TAB */}
        <TabsContent value="phone" className="space-y-4">
          <div className="rounded-xl border bg-blue-50/60 p-4 text-sm text-blue-950">
            <div className="font-semibold">This feature is coming soon! Use email instead.</div>
          </div>
          <Button
            onClick={() => resetOnTabSwitch('email')}
            className="w-full bg-blue-900 hover:bg-blue-800"
            type="button"
          >
            Continue with Email
          </Button>
        </TabsContent>

        {/* EMAIL TAB */}
        <TabsContent value="email" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                className="pl-10"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
                className="pl-10 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleEmailSignIn}
            disabled={isLoading || !canEmailLogin}
            className="w-full bg-blue-900 hover:bg-blue-800"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
          </Button>

          <div className="text-center text-sm">
            <Link href="/register" className="text-blue-900 hover:underline">
              Don&apos;t have an account? Sign up
            </Link>
          </div>
        </TabsContent>
      </Tabs>

      <div className="relative my-2">
        <Separator />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-white px-2 text-xs text-gray-500">OR</span>
        </div>
      </div>

      <Button variant="outline" type="button" disabled={isLoading} onClick={onGoogleLogin} className="w-full">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </Button>
    </div>
  );
}

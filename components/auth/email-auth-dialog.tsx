'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface EmailAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeCode(v: string) {
  return v.replace(/\D/g, '').slice(0, 8);
}

export function EmailAuthDialog({ open, onOpenChange }: EmailAuthDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // Shared UI state
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');

  // Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const title = useMemo(() => (isVerifying ? 'Verify your email' : 'Welcome back'), [isVerifying]);

  const description = useMemo(() => {
    if (isVerifying) return `Enter the 8-digit code we sent to ${signUpEmail}`;
    return 'Sign in or create an account in seconds.';
  }, [isVerifying, signUpEmail]);

  // Reset dialog internal state when closed
  useEffect(() => {
    if (!open) {
      setLoading(false);
      setShowPassword(false);
      setIsVerifying(false);
      setCode('');
      setCooldown(0);
      setActiveTab('signin');
    }
  }, [open]);

  // Cooldown timer (for resend)
  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Google sign-in failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    const email = signInEmail.trim();
    const password = signInPassword.trim();

    if (!email || !password) {
      toast({ title: 'Missing information', description: 'Enter email and password.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();

        toast({ title: 'Welcome!', description: 'Logged in successfully.' });

        onOpenChange(false);
        setSignInEmail('');
        setSignInPassword('');

        if (p?.role === 'admin') router.push('/admin');
        else if (p?.role === 'seller') router.push('/seller');
        else router.refresh();
      }
    } catch (error: any) {
      toast({ title: 'Login failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const email = signUpEmail.trim();
    const name = signUpFullName.trim();
    const password = signUpPassword;

    if (!name || !email || !password) {
      toast({ title: 'Missing information', description: 'Fill in all fields.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (error) throw error;

      setIsVerifying(true);
      setCooldown(30);
      toast({ title: 'Check your email', description: 'We sent you an 8-digit verification code.' });
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.toLowerCase().includes('already') || error?.status === 422) {
        toast({
          title: 'Account exists',
          description: 'You already have an account. Please sign in.',
          variant: 'destructive',
        });
        setActiveTab('signin');
      } else {
        toast({ title: 'Sign up failed', description: msg || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const email = signUpEmail.trim();
    const token = normalizeCode(code);

    if (!email || !isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Go back and enter a valid email.', variant: 'destructive' });
      return;
    }
    if (token.length !== 8) {
      toast({ title: 'Invalid code', description: 'Enter the 8-digit verification code.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        // Upsert profile safely (works even if a trigger creates a row)
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: signUpFullName.trim(),
          email: email,
          role: 'customer',
        });

        if (upsertErr) {
          // Not fatal for login, but show a soft warning
          console.warn('Profile upsert error:', upsertErr);
        }
      }

      toast({ title: 'Success', description: 'Account verified. You are now logged in!' });

      onOpenChange(false);
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpFullName('');
      setCode('');
      setIsVerifying(false);

      router.refresh();
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error?.message || 'Please check the code and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const email = signUpEmail.trim();
    if (!isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email.', variant: 'destructive' });
      return;
    }
    if (cooldown > 0) return;

    setLoading(true);
    try {
      // Supabase resends confirmation email via signUp again for unconfirmed users.
      // This is the common approach unless you implement a custom edge function.
      const { error } = await supabase.auth.signUp({
        email,
        password: signUpPassword,
        options: { data: { full_name: signUpFullName } },
      });

      if (error) throw error;

      setCooldown(30);
      toast({ title: 'Resent', description: 'We sent you a new verification code.' });
    } catch (error: any) {
      toast({ title: 'Resend failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        {/* Premium header */}
        <div className="bg-gradient-to-b from-blue-950 to-blue-900 text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-100">
                <Sparkles className="h-4 w-4 text-blue-200" />
                SPRAXE ACCOUNT
              </div>
              <DialogTitle className="mt-2 text-xl font-extrabold tracking-tight">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-blue-100/80">{description}</DialogDescription>
            </div>

            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-100" />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            {!isVerifying && (
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1">
                <TabsTrigger value="signin" className="rounded-lg">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg">
                  Sign Up
                </TabsTrigger>
              </TabsList>
            )}

            {/* SIGN IN */}
            <TabsContent value="signin" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                    className="pl-10 h-11 rounded-xl pr-10"
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
                onClick={handleSignIn}
                disabled={loading}
                className="w-full h-11 rounded-xl bg-blue-900 hover:bg-blue-800 font-bold"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>

              <Divider />

              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full h-11 rounded-xl font-bold"
                type="button"
                disabled={loading}
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            </TabsContent>

            {/* SIGN UP / VERIFY */}
            <TabsContent value="signup" className="mt-4">
              {isVerifying ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-900 text-white flex items-center justify-center">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-gray-900">Verification required</div>
                        <div className="text-sm text-gray-600 mt-0.5">
                          Enter the <b>8-digit code</b> sent to <b className="break-all">{signUpEmail}</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      placeholder="12345678"
                      value={code}
                      onChange={(e) => setCode(normalizeCode(e.target.value))}
                      className="h-12 rounded-xl text-center text-lg tracking-[0.25em] font-bold"
                      maxLength={8}
                    />
                  </div>

                  <Button
                    onClick={handleVerify}
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-blue-900 hover:bg-blue-800 font-bold"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify & Login
                  </Button>

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setIsVerifying(false)}
                      className="rounded-xl text-gray-600"
                      disabled={loading}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleResend}
                      className="rounded-xl"
                      disabled={loading || cooldown > 0}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      className="h-11 rounded-xl"
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                        className="pl-10 h-11 rounded-xl pr-10"
                        autoComplete="new-password"
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
                    <p className="text-xs text-gray-500">At least 8 characters</p>
                  </div>

                  <Button
                    onClick={handleSignUp}
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-blue-900 hover:bg-blue-800 font-bold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>

                  <Divider />

                  <Button
                    onClick={handleGoogleSignIn}
                    variant="outline"
                    className="w-full h-11 rounded-xl font-bold"
                    type="button"
                    disabled={loading}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </Button>

                  <div className="text-xs text-gray-500 text-center leading-relaxed">
                    By continuing, you agree to our <b>Terms</b> and <b>Privacy Policy</b>.
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Divider() {
  return (
    <div className="relative py-2">
      <Separator className="my-4" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="bg-white px-2 text-xs text-gray-500">OR</span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
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
  );
}

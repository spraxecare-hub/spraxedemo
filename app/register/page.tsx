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
import { Mail, Loader2, Eye, EyeOff, User, Phone, ShieldCheck, ArrowLeft } from 'lucide-react';

/**
 * ✅ Professional improvements included:
 * - consistent brand styling + cleaner spacing
 * - better validation + correct OTP types (email OTP uses "email", phone uses "sms")
 * - 6-digit phone OTP (Supabase default), 6/8-digit email OTP depending on settings (supports both)
 * - prevents double submits, disables buttons correctly
 * - nicer OTP UI + auto numeric-only
 * - better error messaging for "account exists"
 * - safe redirects + reset state on tab switch
 * - avoids remote logo hotlink, uses /spraxe.png like rest of app
 */

type TabKey = 'phone' | 'email';
type EmailStep = 'details' | 'otp';
type PhoneStep = 'phone' | 'otp';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const onlyDigits = (v: string) => v.replace(/\D/g, '');
const normalizeBDPhone = (v: string) => {
  // Accept: 01XXXXXXXXX or +8801XXXXXXXXX or 8801XXXXXXXXX
  const raw = v.trim();
  if (raw.startsWith('+88')) return raw;
  if (raw.startsWith('88')) return `+${raw}`;
  return `+88${raw}`;
};

export default function RegisterPage() {
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
          {/* subtle background glow */}
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
                  Create your account
                </CardTitle>
                <CardDescription className="text-sm">
                  Join Spraxe to start shopping with fast delivery across Bangladesh.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <RegisterForms
                  onLoading={setIsLoading}
                  isLoading={isLoading}
                  onGoogleLogin={handleGoogleSignIn}
                />

                <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
                  By registering, you agree to our{' '}
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
            Already have an account?{' '}
            <Link href="/login" className="text-blue-900 font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

/* ------------------------------ Forms ------------------------------ */

function RegisterForms({
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

  // Common
  const [fullName, setFullName] = useState('');

  // Email
  const [emailStep, setEmailStep] = useState<EmailStep>('details');
  const [showPassword, setShowPassword] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [emailOtp, setEmailOtp] = useState('');

  // Phone
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');

  const canSubmitEmailDetails = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      isValidEmail(signUpEmail) &&
      signUpPassword.trim().length >= 8
    );
  }, [fullName, signUpEmail, signUpPassword]);

  const canSubmitPhone = useMemo(() => {
    const digits = onlyDigits(phoneNumber);
    return fullName.trim().length >= 2 && digits.length === 11 && digits.startsWith('01');
  }, [fullName, phoneNumber]);

  const resetStepsOnTabSwitch = (next: TabKey) => {
    setTab(next);
    // reset steps for cleaner UX
    setEmailStep('details');
    setEmailOtp('');
    setPhoneStep('phone');
    setPhoneOtp('');
  };

  // EMAIL SIGNUP
  const handleEmailSignUp = async () => {
    if (!fullName.trim() || !signUpEmail.trim() || !signUpPassword.trim()) {
      toast({ title: 'Missing information', description: 'Please fill all fields.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(signUpEmail)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (signUpPassword.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }

    onLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) throw error;

      // If email confirmations are enabled, user may need OTP/email confirm
      toast({
        title: 'Check your email',
        description: `We sent a verification code to ${signUpEmail.trim()}.`,
      });
      setEmailStep('otp');

      // In some setups user may already be "confirmed"
      if (data.user && data.user.email_confirmed_at) {
        router.push('/');
      }
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.includes('already registered') || msg.includes('already exists') || error?.status === 422) {
        toast({
          title: 'Account already exists',
          description: 'You already have an account. Please sign in.',
          variant: 'destructive',
        });
        router.push('/login');
      } else {
        toast({ title: 'Registration failed', description: msg || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      onLoading(false);
    }
  };

  // EMAIL OTP VERIFY
  const handleVerifyEmailOTP = async () => {
    const token = onlyDigits(emailOtp);
    // Some Supabase setups send 6 digits, some 8 — allow 6-8
    if (token.length < 6 || token.length > 8) {
      toast({ title: 'Invalid code', description: 'Enter the verification code from email.', variant: 'destructive' });
      return;
    }

    onLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: signUpEmail.trim(),
        token,
        type: 'email', // ✅ correct for email OTP
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: signUpEmail.trim(),
          role: 'customer',
        });

        toast({ title: 'Verified!', description: 'Your email has been verified.' });
        router.push('/');
      }
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      onLoading(false);
    }
  };

  // PHONE OTP SEND
  const handleSendOTP = async () => {
    if (!fullName.trim()) {
      toast({ title: 'Missing name', description: 'Please enter your full name.', variant: 'destructive' });
      return;
    }

    const digits = onlyDigits(phoneNumber);
    if (digits.length !== 11 || !digits.startsWith('01')) {
      toast({
        title: 'Invalid phone number',
        description: 'Use an 11-digit BD number (01XXXXXXXXX).',
        variant: 'destructive',
      });
      return;
    }

    onLoading(true);
    try {
      const formattedPhone = normalizeBDPhone(digits);
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) throw error;

      toast({ title: 'OTP sent', description: 'Please check your SMS for the code.' });
      setPhoneStep('otp');
    } catch (error: any) {
      toast({ title: 'Failed to send OTP', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      onLoading(false);
    }
  };

  // PHONE OTP VERIFY
  const handleVerifyPhoneOTP = async () => {
    const token = onlyDigits(phoneOtp);
    // Supabase SMS OTP is typically 6 digits
    if (token.length !== 6) {
      toast({ title: 'Invalid OTP', description: 'Enter the 6-digit SMS code.', variant: 'destructive' });
      return;
    }

    onLoading(true);
    try {
      const formattedPhone = normalizeBDPhone(onlyDigits(phoneNumber));
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          phone: formattedPhone,
          role: 'customer',
        });

        toast({ title: 'Welcome!', description: 'Your phone number has been verified.' });
        router.push('/');
      }
    } catch (error: any) {
      toast({ title: 'Verification failed', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(v) => resetStepsOnTabSwitch(v as TabKey)} className="w-full">
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
          {phoneStep === 'phone' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone-name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone-name"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    inputMode="numeric"
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={onlyDigits(phoneNumber)}
                    onChange={(e) => setPhoneNumber(onlyDigits(e.target.value))}
                    maxLength={11}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500">We’ll send a 6-digit code via SMS.</p>
              </div>

              <Button
                onClick={handleSendOTP}
                disabled={isLoading || !canSubmitPhone}
                className="w-full bg-blue-900 hover:bg-blue-800"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send OTP'}
              </Button>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="rounded-xl border bg-blue-50/60 p-3">
                <div className="flex items-start gap-2 text-blue-950">
                  <ShieldCheck className="h-5 w-5 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold">Verify your phone</div>
                    <div className="text-xs text-blue-900/70">
                      Enter the 6-digit code sent to <span className="font-medium">{onlyDigits(phoneNumber)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneOtp">OTP code</Label>
                <Input
                  id="phoneOtp"
                  inputMode="numeric"
                  placeholder="000000"
                  value={onlyDigits(phoneOtp)}
                  onChange={(e) => setPhoneOtp(onlyDigits(e.target.value))}
                  maxLength={6}
                  className="text-center text-xl tracking-[0.35em] font-semibold"
                />
              </div>

              <Button
                onClick={handleVerifyPhoneOTP}
                disabled={isLoading || onlyDigits(phoneOtp).length !== 6}
                className="w-full bg-blue-900 hover:bg-blue-800"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & Create Account'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setPhoneStep('phone');
                  setPhoneOtp('');
                }}
                disabled={isLoading}
                className="w-full text-gray-600"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Change phone number
              </Button>
            </div>
          )}
        </TabsContent>

        {/* EMAIL TAB */}
        <TabsContent value="email" className="space-y-4">
          {emailStep === 'details' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email-name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email-name"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailSignUp()}
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
                <p className="text-xs text-gray-500">At least 8 characters.</p>
              </div>

              <Button
                onClick={handleEmailSignUp}
                disabled={isLoading || !canSubmitEmailDetails}
                className="w-full bg-blue-900 hover:bg-blue-800"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create account'}
              </Button>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="rounded-xl border bg-blue-50/60 p-3">
                <div className="flex items-start gap-2 text-blue-950">
                  <ShieldCheck className="h-5 w-5 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold">Verify your email</div>
                    <div className="text-xs text-blue-900/70">
                      Enter the code sent to <span className="font-medium">{signUpEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailOtp">Verification code</Label>
                <Input
                  id="emailOtp"
                  inputMode="numeric"
                  placeholder="123456"
                  value={onlyDigits(emailOtp)}
                  onChange={(e) => setEmailOtp(onlyDigits(e.target.value))}
                  maxLength={8}
                  className="text-center text-xl tracking-[0.35em] font-semibold"
                />
                <p className="text-xs text-gray-500">Code length may be 6–8 digits depending on your Supabase settings.</p>
              </div>

              <Button
                onClick={handleVerifyEmailOTP}
                disabled={isLoading || onlyDigits(emailOtp).length < 6}
                className="w-full bg-blue-900 hover:bg-blue-800"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & finish'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setEmailStep('details');
                  setEmailOtp('');
                }}
                disabled={isLoading}
                className="w-full text-gray-600"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Change email
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="relative my-2">
        <Separator />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-white px-2 text-xs text-gray-500">OR</span>
        </div>
      </div>

      <Button
        variant="outline"
        type="button"
        disabled={isLoading}
        onClick={onGoogleLogin}
        className="w-full"
      >
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

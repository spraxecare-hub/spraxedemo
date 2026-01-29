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
  Phone,
  Loader2,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  MessageSquareText,
  Clock,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PhoneAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizeBDPhone(input: string) {
  // keep digits only; accept 01xxxxxxxxx or +8801xxxxxxxxx or 8801xxxxxxxxx
  const digits = input.replace(/\D/g, '');

  // If user typed 8801..., keep last 11 (01xxxxxxxxx)
  if (digits.startsWith('8801') && digits.length >= 13) return digits.slice(2, 13); // -> 01xxxxxxxxx
  if (digits.startsWith('01')) return digits.slice(0, 11);

  // If user typed 1xxxxxxxxx (missing leading 0), fix it
  if (digits.startsWith('1') && digits.length >= 10) return `0${digits.slice(0, 10)}`.slice(0, 11);

  return digits.slice(0, 11);
}

function toE164BD(phone11: string) {
  // expects 01xxxxxxxxx
  return `+88${phone11}`;
}

function normalizeOTP(input: string) {
  return input.replace(/\D/g, '').slice(0, 6);
}

export function PhoneAuthDialog({ open, onOpenChange }: PhoneAuthDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone11, setPhone11] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);

  const formattedE164 = useMemo(() => (phone11.length === 11 ? toE164BD(phone11) : ''), [phone11]);

  const title = useMemo(() => (step === 'phone' ? 'Sign in with phone' : 'Verify OTP'), [step]);

  const description = useMemo(() => {
    if (step === 'phone') return 'We’ll send a 6-digit code to your mobile number.';
    return `Enter the 6-digit code sent to ${formattedE164 || '+8801XXXXXXXXX'}`;
  }, [step, formattedE164]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('phone');
      setPhone11('');
      setOtp('');
      setLoading(false);
      setCooldown(0);
    }
  }, [open]);

  // Cooldown timer
  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSendOTP = async () => {
    if (phone11.length !== 11 || !phone11.startsWith('01')) {
      toast({
        title: 'Invalid phone number',
        description: 'Enter a valid 11-digit BD number (01XXXXXXXXX).',
        variant: 'destructive',
      });
      return;
    }
    if (cooldown > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: toE164BD(phone11),
      });

      if (error) throw error;

      toast({
        title: 'OTP sent',
        description: 'Check your SMS inbox for the verification code.',
      });

      setStep('otp');
      setCooldown(30);
    } catch (error: any) {
      toast({
        title: 'Failed to send OTP',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const token = normalizeOTP(otp);
    if (token.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit code.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: toE164BD(phone11),
        token,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        // Make sure profile exists / upsert phone (optional but professional)
        await supabase.from('profiles').upsert({
          id: data.user.id,
          phone: phone11,
          role: 'customer',
        });

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        toast({ title: 'Success', description: 'Logged in successfully.' });

        onOpenChange(false);
        setStep('phone');
        setPhone11('');
        setOtp('');

        if (profile?.role === 'admin') router.push('/admin');
        else if (profile?.role === 'seller') router.push('/seller');
        else if (profile?.role === 'seller') router.push('/seller');
        else router.refresh();
      }
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error?.message || 'Invalid OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    await handleSendOTP();
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
        <div className="px-6 py-6 space-y-4">
          {step === 'phone' ? (
            <>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-900 text-white flex items-center justify-center">
                    <MessageSquareText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-gray-900">Get a login code</div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      We’ll send an OTP to your phone. Standard SMS charges may apply.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone11}
                    onChange={(e) => setPhone11(normalizeBDPhone(e.target.value))}
                    maxLength={11}
                    className="pl-10 h-11 rounded-xl"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Format: 01XXXXXXXXX</span>
                  <span className="font-medium text-gray-600">{phone11.length}/11</span>
                </div>
              </div>

              <Button
                onClick={handleSendOTP}
                disabled={loading || phone11.length !== 11 || cooldown > 0}
                className="w-full h-11 rounded-xl bg-blue-900 hover:bg-blue-800 font-bold"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send OTP'}
              </Button>

              <div className="text-xs text-gray-500 text-center">
                By continuing, you agree to our <b>Terms</b> and <b>Privacy Policy</b>.
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={handleBack} disabled={loading} className="rounded-xl text-gray-600">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-4 w-4" />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'You can resend now'}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(normalizeOTP(e.target.value))}
                  maxLength={6}
                  className="h-12 rounded-xl text-center text-2xl tracking-[0.35em] font-extrabold"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <div className="text-xs text-gray-500 text-center">
                  Sent to <b>{formattedE164}</b>
                </div>
              </div>

              <Button
                onClick={handleVerifyOTP}
                disabled={loading || normalizeOTP(otp).length !== 6}
                className="w-full h-11 rounded-xl bg-blue-900 hover:bg-blue-800 font-bold"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify & Login
              </Button>

              <div className="relative py-2">
                <Separator className="my-3" />
              </div>

              <Button
                variant="outline"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="w-full h-11 rounded-xl font-bold"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

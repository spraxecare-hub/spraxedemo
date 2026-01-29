'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, CheckCircle2, AlertTriangle, Info, Bell } from 'lucide-react';

import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitives.Provider;

/**
 * ✅ Professional improvements:
 * - Better placement (top-right desktop, bottom on mobile)
 * - Better spacing + padding
 * - Softer shadow + border
 * - Variant icons + colored left accent bar
 * - Optional progress bar (works great if you use durations)
 * - Better close button visibility + focus ring
 */

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Mobile: bottom, Desktop: top-right
      'fixed z-[120] flex max-h-screen w-full flex-col gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:max-w-[420px] md:top-4 md:bottom-auto md:right-4',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  [
    'group pointer-events-auto relative w-full overflow-hidden rounded-xl border',
    'bg-white text-gray-900 shadow-lg shadow-black/5',
    'transition-all',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:slide-in-from-bottom-full sm:data-[state=open]:slide-in-from-bottom-full md:data-[state=open]:slide-in-from-top-full',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
    'data-[swipe=cancel]:translate-x-0',
    'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:animate-out',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-gray-200',
        success: 'border-emerald-200',
        info: 'border-blue-200',
        warning: 'border-amber-200',
        destructive: 'border-red-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const accentVariants = {
  default: 'bg-gray-900/60',
  success: 'bg-emerald-600',
  info: 'bg-blue-600',
  warning: 'bg-amber-500',
  destructive: 'bg-red-600',
} as const;

const iconVariants = {
  default: Bell,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  destructive: AlertTriangle,
} as const;

type ToastRootProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    /** Optional: show a progress bar animation (purely visual) */
    showProgress?: boolean;
    /** Optional: progress duration in ms (match your toast duration) */
    durationMs?: number;
  };

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastRootProps>(
  ({ className, variant, showProgress = false, durationMs = 4000, ...props }, ref) => {
    const Icon = iconVariants[(variant || 'default') as keyof typeof iconVariants] || Bell;

    return (
      <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props}>
        {/* left accent */}
        <div
          className={cn(
            'absolute left-0 top-0 h-full w-1.5',
            accentVariants[(variant || 'default') as keyof typeof accentVariants]
          )}
        />

        {/* content layout */}
        <div className="flex gap-3 p-4 pr-10">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border bg-gray-50',
              variant === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              variant === 'info' && 'border-blue-200 bg-blue-50 text-blue-700',
              variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
              variant === 'destructive' && 'border-red-200 bg-red-50 text-red-700',
              variant === 'default' && 'border-gray-200 text-gray-700'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Title + Description will be rendered by ToastTitle/ToastDescription in Toaster */}
            {props.children}
          </div>
        </div>

        {/* progress (visual only) */}
        {showProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
            <div
              className={cn(
                'h-full origin-left scale-x-100',
                accentVariants[(variant || 'default') as keyof typeof accentVariants]
              )}
              style={{
                animation: `toast-progress ${Math.max(800, durationMs)}ms linear forwards`,
              }}
            />
          </div>
        )}

        <style jsx global>{`
          @keyframes toast-progress {
            from {
              transform: scaleX(1);
            }
            to {
              transform: scaleX(0);
            }
          }
        `}</style>
      </ToastPrimitives.Root>
    );
  }
);
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-semibold',
      'bg-white text-gray-900 border-gray-200',
      'transition-colors hover:bg-gray-50',
      'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-gray-500',
      'opacity-100 md:opacity-0 md:group-hover:opacity-100',
      'transition-opacity hover:text-gray-900',
      'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-extrabold text-gray-900 leading-5', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('mt-1 text-sm text-gray-600 leading-5', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};

'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Facebook,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Truck,
  BadgeCheck,
} from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-300 border-t border-white/5">
      {/* Top trust bar */}
      <div className="border-b border-white/5">
        {/* ✅ CHANGED: wider container + better side padding */}
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TrustItem
              icon={<Truck className="h-5 w-5" />}
              title="Fast Delivery"
              desc="Inside Dhaka & Nationwide"
            />
            <TrustItem
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Secure Checkout"
              desc="Safe payments & privacy"
            />
            <TrustItem
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Quality Assured"
              desc="Checked products & support"
            />
          </div>
        </div>
      </div>

      {/* Main footer */}
      {/* ✅ CHANGED: wider container + better side padding */}
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-4 space-y-4">
            {/* Footer logo (single mark + wordmark) */}
            <Link href="/" className="inline-flex items-center group">
              <Image
                src="/footer.png"
                alt="Spraxe"
                width={520}
                height={140}
                priority
                className="h-12 sm:h-14 md:h-16 w-auto"
              />
            </Link>

            <p className="text-sm leading-relaxed text-gray-400 max-w-sm">
              Bangladesh’s modern e-commerce store for quality products at fair prices — with reliable delivery and
              real support.
            </p>

            {/* Newsletter (optional, no backend) */}
            <div className="pt-2">
              <div className="text-xs font-semibold text-gray-300 mb-2">Get updates</div>
              <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-gray-500
                             outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-600/40"
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition inline-flex items-center gap-2"
                >
                  Subscribe <ArrowRight className="h-4 w-4" />
                </button>
              </form>
              <div className="text-xs text-gray-500 mt-2">No spam. Unsubscribe anytime.</div>
            </div>
          </div>

          {/* Links */}
          <div className="md:col-span-2">
            <FooterHeading>Shop</FooterHeading>
            <ul className="space-y-2 text-sm">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/products">Products</FooterLink>
              <FooterLink href="/categories">Categories</FooterLink>
              <FooterLink href="/featured">Featured</FooterLink>
              <FooterLink href="/compare">Compare</FooterLink>
              <FooterLink href="/apple-accessories">Apple Accessories</FooterLink>
              <FooterLink href="/usb-c-hubs-for-macbook">USB-C Hubs for MacBook</FooterLink>
              <FooterLink href="/thunderbolt-docks">Thunderbolt Docks</FooterLink>
            </ul>
          </div>

          <div className="md:col-span-3">
            <FooterHeading>Support</FooterHeading>
            <ul className="space-y-2 text-sm">
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/support">Support Desk</FooterLink>
              <FooterLink href="/track-order">Track Order</FooterLink>
              <FooterLink href="/faq">FAQ</FooterLink>
              <FooterLink href="/blog">Blog</FooterLink>
              <FooterLink href="/terms">Terms & Conditions</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/returns">Returns & Refunds</FooterLink>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <FooterHeading>Contact</FooterHeading>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <a href="mailto:spraxecare@gmail.com" className="hover:text-blue-300 transition">
                  spraxecare@gmail.com
                </a>
              </li>

              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <a href="tel:+8809638371951" className="hover:text-blue-300 transition">
                  09638371951
                </a>
              </li>

              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <span className="text-gray-400">Vatara, Dhaka, Bangladesh</span>
              </li>
            </ul>

            {/* Socials */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-gray-300 mb-2">Follow</div>
              <div className="flex items-center gap-2">
                <SocialIcon href="https://facebook.com" label="Facebook" icon={<Facebook className="h-4 w-4" />} />
                <SocialIcon href="https://instagram.com" label="Instagram" icon={<Instagram className="h-4 w-4" />} />
                <SocialIcon href="https://youtube.com" label="YouTube" icon={<Youtube className="h-4 w-4" />} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-8 border-t border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Spraxe. All rights reserved.{' '}
            <span className="text-gray-500">
              Developed and Managed by{' '}
              <a
                href="https://www.facebook.com/hridoy.hossen.roni.2025"
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-blue-300 transition"
              >
                Roni
              </a>
              .
            </span>
          </p>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="text-gray-500 hover:text-gray-300 transition">
              Terms
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition">
              Privacy
            </Link>
            <Link href="/support" className="text-gray-500 hover:text-gray-300 transition">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-extrabold mb-4 tracking-tight">{children}</h3>;
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-gray-400 hover:text-blue-300 transition">
        {children}
      </Link>
    </li>
  );
}

function SocialIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 inline-flex items-center justify-center
                 text-gray-200 hover:text-white hover:border-white/20 hover:bg-white/10 transition"
    >
      {icon}
    </a>
  );
}

function TrustItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
      <div className="h-10 w-10 rounded-xl bg-blue-600/15 border border-blue-600/20 text-blue-200 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-sm font-extrabold text-white">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

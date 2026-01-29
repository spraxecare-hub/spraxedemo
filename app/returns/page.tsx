'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReturnsPage() {
  const sections = [
    {
      title: '1. Eligibility for Return',
      text:
        '• Items must be unused, in original packaging, and in resellable condition.\n• Return requests should be placed within 7 days of delivery (unless stated otherwise on the product page).',
    },
    {
      title: '2. Wrong / Damaged Item',
      text:
        'If you receive the wrong item, a missing item, or something arrives damaged, please contact Support within 24 hours of delivery.\n\nTip: Keep the packaging and (if possible) an unboxing video or clear photos — it helps us resolve faster.',
    },
    {
      title: '3. Non‑Returnable Items',
      text:
        'Some products may not be eligible for return due to hygiene, safety, or clearance reasons. If a product is non-returnable, it will be mentioned on the product page.',
    },
    {
      title: '4. Refunds',
      text:
        '• Once the return is received and inspected, we’ll confirm approval.\n• Refunds are issued to the original payment method where possible. For Cash on Delivery orders, we may request a bKash/Nagad number for refund.',
    },
    {
      title: '5. How to Request a Return',
      text:
        'Go to the Support Desk and open a ticket with your order number, product name, and the reason for return. Our team will guide you with the next steps.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-12 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-black">Returns & Refunds</h1>
            <p className="text-xl text-gray-600">Simple policy. Fast resolution. Real support.</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {sections.map((sec, idx) => (
              <Card key={idx}>
                <CardContent className="p-6">
                  <h2 className="text-2xl font-semibold mb-3">{sec.title}</h2>
                  <p className="text-gray-700 whitespace-pre-line">{sec.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-8">
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Need help with a return?</div>
                <div className="text-gray-600">Open a ticket and we’ll respond as quickly as possible.</div>
              </div>
              <Link href="/support">
                <Button>Go to Support Desk</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}

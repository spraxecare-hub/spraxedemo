'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';

export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: "1. Introduction",
      text: `At Spraxe, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, protect, and store your personal information when you use our website or make a purchase.`
    },
    {
      title: "2. Information We Collect",
      text: `a. Personal Information:
- Name
- Phone number
- Email address
- Delivery address

b. Payment Information:
We do NOT store your full payment details. Payments (Bkash, Nagad) are handled securely through trusted partners.

c. Technical & Usage Data:
- IP address
- Browser & device details
- Cookies & tracking data
- Pages visited, actions taken, and time spent`
    },
    {
      title: "3. How We Use Your Information",
      text: `• To process and deliver your orders
• To provide customer support
• To send order updates or promotions (if subscribed)
• To improve user experience and website performance
• To prevent fraud or misuse`
    },
    {
      title: "4. Sharing Your Information",
      text: `We do NOT sell or rent your information.

We may share your data with:
• Courier and delivery partners
• Payment service providers
• Government authorities (only when required by law)`
    },
    {
      title: "5. Cookies & Tracking",
      text: `We use cookies to improve your experience, remember preferences, and analyze performance. You can disable cookies in your browser, but some features may not work properly.`
    },
    {
      title: "6. Data Security",
      text: `We use encryption, secure servers, and access controls to protect your information. Although no online platform is 100% risk-free, we take every reasonable step to safeguard your data.`
    },
    {
      title: "7. Your Rights",
      text: `You have the right to:
• Request access to your data
• Update or correct information
• Request deletion of your data
• Unsubscribe from promotional messages

To make a request, contact: spraxecare@gmail.com`
    },
    {
      title: "8. Children's Privacy",
      text: `We do not knowingly collect information from children under 13. If you believe a child has submitted information, contact us and we will remove it immediately.`
    },
    {
      title: "9. Policy Updates",
      text: `We may update this privacy policy occasionally. Continued use of our website means you accept the updated policy.`
    },
    {
      title: "10. Contact Us",
      text: `Email: spraxecare@gmail.com
Phone: +8809638371951`
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Header */}
      <Header />

      {/* Content */}
      <div className="container mx-auto px-4 py-12 flex-1">
        <div className="max-w-4xl mx-auto">

          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-black">Privacy Policy</h1>
            <p className="text-xl text-gray-600">Effective Date: 01 January 2026</p>
          </div>

          {/* Sections */}
          <div className="grid grid-cols-1 gap-6">
            {sections.map((sec, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <h2 className="text-2xl font-semibold mb-3">{sec.title}</h2>
                  <p className="text-gray-700 whitespace-pre-line">{sec.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsPage() {
  const terms = [
    {
      title: "1. Using Our Website",
      text: "By using Spraxe, you agree to follow our terms and rules. If you do not agree, please stop using the website."
    },
    {
      title: "2. Orders & Payments",
      text: "• Some products may require advance or partial payment.\n• You must provide correct information when ordering.\n• Orders may be cancelled if details are invalid or suspected as fraud."
    },
    {
      title: "3. Delivery",
      text: "Delivery usually takes 2–5 working days. Delays may occur due to courier workload, weather, traffic, or other issues."
    },
    {
      title: "4. Returns & Replacements",
      text: "• Returns and replacements are allowed based on our Return Policy.\n• Items damaged through customer misuse are not eligible."
    },
    {
      title: "5. Your Responsibilities",
      text: "• Provide correct and truthful information.\n• Do not misuse the website or engage in illegal or fraudulent activity."
    },
    {
      title: "6. Limitation of Liability",
      text: "Spraxe is not responsible for courier delays, indirect losses, or failures caused by third-party services."
    },
    {
      title: "7. Updates to Terms",
      text: "We may update these Terms & Conditions at any time. Continued use of the website means you accept the updated terms."
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 flex-1">
        <div className="max-w-4xl mx-auto">

          {/* Title Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-black">Terms & Conditions</h1>
            <p className="text-xl text-gray-600">Read our rules and usage policies for Spraxe</p>
          </div>

          {/* Terms Cards */}
          <div className="grid grid-cols-1 gap-6">
            {terms.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-2">{item.title}</h2>
                  <p className="text-gray-700 whitespace-pre-line">{item.text}</p>
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

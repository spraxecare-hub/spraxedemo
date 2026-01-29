'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';

export default function FAQPage() {
  const faqs = [
    {
      question: "1. Is an advance payment required to place an order?",
      answer: "Yes. For all electronics products ordered from Spraxe, a partial advance payment is required."
    },
    {
      question: "2. How can I contact customer support?",
      answer: "You can reach us through our support email, WhatsApp, or hotline number."
    },
    {
      question: "3. Is my personal information safe?",
      answer: "Yes. We follow strict privacy and security measures to protect your data."
    },
    {
      question: "4. What payment methods are accepted?",
      answer: "We accept secure online payment methods (Bkash, Nagad) and cash on delivery (if applicable)."
    },
    {
      question: "5. How much is the delivery charge?",
      answer: "Inside Dhaka City Corporation: 60 BDT\nSavar, Gazipur, Keraniganj: 100 BDT\nAll over Bangladesh: 120 BDT\nNote: Delivery usually takes 2–5 business days depending on your location."
    },
    {
      question: "6. Can I return or replace a product?",
      answer: "Yes, returns and replacements are available according to our Return Policy."
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
            <h1 className="text-4xl font-bold mb-4 text-black">Frequently Asked Questions (FAQ)</h1>
            <p className="text-xl text-gray-600">Find answers to common questions about Spraxe</p>
          </div>

          {/* FAQ Cards */}
          <div className="grid grid-cols-1 gap-6">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-2">{faq.question}</h2>
                  <p className="text-gray-700 whitespace-pre-line">{faq.answer}</p>
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

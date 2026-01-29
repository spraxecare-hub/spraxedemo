import React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="w-full max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="rounded-3xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 text-center">
            About Us
          </h1>

          <div className="mt-6 space-y-4 text-gray-700 leading-relaxed">
            <p>
              <b>Welcome to Spraxe</b>, your trusted online destination for quality products and seamless shopping
              experiences. Founded with a passion for bringing convenience and reliability to every customer, we are
              committed to offering high-quality products, exceptional service, and a shopping experience you can count
              on.
            </p>

            <p>
              At Spraxe, we believe in transparency, trust, and customer satisfaction. Every item we offer is carefully
              selected, and our team works tirelessly to ensure that your orders are processed quickly, delivered safely,
              and supported with friendly customer service.
            </p>

            <p>
              Our mission is simple: to make online shopping safe, easy, and enjoyable for everyone. Whether you’re
              looking for the latest gadgets, lifestyle products, or everyday essentials, we aim to provide a platform
              that prioritizes your confidence and convenience.
            </p>

            <p>
              We are proud to serve customers across Bangladesh and beyond, and we continually strive to improve our
              services based on your feedback. Thank you for choosing Spraxe — your satisfaction is our top priority.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

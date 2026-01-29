# Spraxe - Modern E-Commerce Platform

A modern, production-ready retail e-commerce platform built for the Bangladesh market, with seller product submission capabilities.

## Features

### Core Features
- **Product Catalog** - Browse products with categories, filters, and search
- **Simple Retail** - Individual customer shopping experience
- **User Authentication** - Email/password signup and login (Phone OTP ready for Phase 2)
- **Shopping Cart** - Add products to cart with quantity management
- **User Dashboard** - Order history, profile management, saved addresses
- **Admin Dashboard** - Product management, order tracking, customer management
- **Seller Submission** - Sellers can apply to submit products for admin approval
- **Support Desk** - Submit tickets for inquiries, complaints, and refund requests

### Technical Stack
- **Frontend**: Next.js 13.5, React 18, TailwindCSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend**: Supabase (PostgreSQL database)
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (Frontend) / Supabase (Database)

## Database Schema

The platform includes the following tables:
- `profiles` - User profiles with role management (customer/seller/admin)
- `categories` - Product categories with hierarchy support
- `products` - Product catalog with pricing, inventory, and seller tracking
- `seller_applications` - Seller registration requests
- `cart_items` - Shopping cart items
- `orders` - Order management with tracking
- `order_items` - Order line items
- `addresses` - Delivery addresses
- `support_tickets` - Customer support tickets
- `site_settings` - Configurable site settings

All tables have Row Level Security (RLS) enabled for data protection.

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account (already configured)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in at least:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (Optional, server-only) Set `SUPABASE_SERVICE_ROLE_KEY` if you want admin-only API routes
     (like order placement/invoice generation) to bypass RLS.

3. The database schema is already applied to your Supabase instance.

4. Create an admin user:
   - Sign up through the website at `/auth/signup`
   - Go to Supabase Dashboard > Table Editor > profiles
   - Find your user and change `role` from 'customer' to 'admin'

### Development

Run the development server:
```bash
npm run dev
```

Visit http://localhost:3000 to see the application.

### Building for Production

Build the application:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## User Roles

### Customer
- Browse products and categories
- Add products to cart
- Place orders
- View order history
- Manage profile and addresses
- Submit support tickets

### Seller
- All customer features
- Apply to become a seller
- Submit products for admin approval
- View own product submissions
- Once approved, can add products directly

### Admin
- All customer and seller features
- Approve/reject seller applications
- Approve/reject product submissions
- Add/edit/delete all products
- Manage categories
- View all orders and update status
- Manage order shipping and tracking
- View and respond to support tickets
- Access admin dashboard at `/admin`

## Key Pages

- **/** - Homepage with featured products and categories
- **/products** - Product catalog with search and filters
- **/products/[slug]** - Individual product details
- **/cart** - Shopping cart
- **/dashboard** - User dashboard
- **/support** - Support desk
- **/admin** - Admin dashboard (admin only)
- **/admin/products/new** - Add new product (admin/approved sellers)

## Blog

- **/admin/blogs** - Create/edit blog posts (admin only). Supports rich text formatting and inline images.
- **/blog** - Public blog index (shows only published posts)
- **/blog/[slug]** - Blog post page

### Images (Supabase Storage)

The blog editor can upload images directly to Supabase Storage.

- Create a **public** bucket named `blog-images` (or set `NEXT_PUBLIC_BLOG_BUCKET` to your bucket name).
- Ensure your Storage policies allow authenticated admins to upload.

### Public visibility

If your Supabase `blogs` table has RLS enabled, you must allow public reads of published posts.
This repo includes a migration that creates a policy allowing `select` where `is_published = true`.

If you cannot change RLS right now, you can alternatively set `SUPABASE_SERVICE_ROLE_KEY` (server-only) on your host
so `/blog` can read published posts.

## Adding Sample Data

Sample categories have already been added. To add sample retail products:

1. Log in as admin
2. Go to `/admin/products/new`
3. Fill in the product details (name, price, stock, etc.)
4. Check "Feature this product" to show on homepage
5. Click "Create Product"

## Phase 1 Complete Features

- Simple retail e-commerce platform
- Product catalog with categories
- Shopping cart and basic checkout
- User authentication (email/password)
- Admin product management
- Seller product submission system
- Support ticket system
- Order management

## Phase 2 Planned Features

- **Payment Gateway**: SSLCOMMERZ integration for card, mobile banking, internet banking
- **Phone OTP**: SMS-based authentication with Bangladeshi phone numbers
- **Email Notifications**: Order confirmations, shipping updates, seller approvals
- **Live Chat**: Messenger or WhatsApp Business integration
- **Advanced Search**: Full-text search or Algolia integration
- **Image Upload**: Product image management with CDN
- **Order Tracking**: Real-time order status updates with tracking numbers
- **Invoice Generation**: Downloadable PDF invoices
- **Reviews & Ratings**: Product reviews and ratings system
- **Wishlist**: Save products for later
- **Advanced Analytics**: Sales reports, charts, and insights
- **Seller Dashboard**: Dedicated dashboard for sellers to manage their products
- **Multi-vendor Features**: Commission tracking, seller payouts

## Support

For issues or questions:
- Email: support@spraxe.com
- Phone: +880 1XXXXXXXXX
- Support Desk: Available on website

## Deployment

### Deploy to Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Deploy

The database is already hosted on Supabase and ready to use.

## License

Private - All Rights Reserved


---

## Render / Custom Domain Notes (to avoid redirect loops)

If your browser shows **ERR_TOO_MANY_REDIRECTS** (infinite redirect loop), this is almost always caused by **domain/CDN settings** (www vs non-www redirects, or Cloudflare SSL mode), not the Next.js code.

### Recommended setup
- In **Render → Custom Domains**, pick **one primary domain** (either `example.com` OR `www.example.com`) and redirect the other to it.
- If using **Cloudflare**, set **SSL/TLS Encryption Mode** to **Full** (or **Full (strict)**) and avoid the problematic **Flexible** mode.

Also set **SITE_URL** or **NEXT_PUBLIC_SITE_URL** on Render to your primary domain (e.g. `https://spaxe.com`) so sitemap/metadata URLs are correct.

export type UserRole = 'customer' | 'seller' | 'admin';
export type SellerStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type TicketType = 'complaint' | 'refund' | 'issue' | 'inquiry';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  phone: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  full_name: string;
  company_name: string | null;
  business_type: string | null;
  role: UserRole;
  seller_status: SellerStatus | null;
  shop_name: string | null;
  shop_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  sku: string;
  images: string[];
  price: number;
  base_price?: number;
  retail_price: number | null;
  stock_quantity: number;
  unit: string;
  // Color variants (optional)
  color_group_id?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  is_active: boolean;
  is_featured: boolean;
  seller_id: string | null;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductSpec {
  id: string;
  product_id: string;
  label: string;
  value: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SellerApplication {
  id: string;
  user_id: string;
  shop_name: string;
  shop_description: string | null;
  business_address: string;
  phone: string;
  email: string;
  status: ApprovalStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  district: string;
  postal_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  size?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_transaction_id: string | null;
  shipping_address_id: string | null;
  notes: string | null;
  admin_notes: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  size?: string | null;
  color_name?: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  type: TicketType;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteSetting {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

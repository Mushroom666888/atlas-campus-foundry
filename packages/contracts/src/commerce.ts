import { z } from "zod";
export const shopInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000),
    location: z.string().trim().max(160),
  })
  .strict();
export const commerceProductInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4000),
    category: z.string().trim().min(1).max(40),
    priceCents: z.number().int().min(1).max(10000000),
    stock: z.number().int().min(0).max(100000),
    imageId: z.uuid().nullable().default(null),
  })
  .strict();
export const orderInput = z
  .object({
    productId: z.uuid(),
    expectedPriceCents: z.number().int().min(1).max(10000000),
    quantity: z.number().int().min(1).max(100),
    requestKey: z.uuid(),
    coupon: z.string().trim().max(32).default(""),
  })
  .strict();
export const couponInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,32}$/),
    discountCents: z.number().int().min(1).max(10000000),
    minimumCents: z.number().int().min(0).max(1000000000),
    maxUses: z.number().int().min(1).max(100000),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const serviceInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000),
    priceCents: z.number().int().min(0).max(10000000),
    startsAt: z.iso.datetime({ offset: true }),
    capacity: z.number().int().min(1).max(10000),
  })
  .strict();
export type Shop = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  location: string;
};
export type CommerceProduct = {
  id: string;
  shop_id: string;
  shop_name: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  stock: number;
  status: "active" | "paused";
  version: number;
  image_id: string | null;
};
export type CommerceOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  title: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  status: "placed" | "accepted" | "ready" | "completed" | "cancelled";
  fulfillment_note: string;
  created_at: string;
};
export type ServiceSlot = {
  id: string;
  shop_id: string;
  shop_name: string;
  owner_id: string;
  title: string;
  description: string;
  price_cents: number;
  starts_at: string;
  capacity: number;
  reserved: number;
  status: string;
};
export type Booking = {
  id: string;
  service_id: string;
  user_id: string;
  title: string;
  owner_id: string;
  starts_at: string;
  price_cents: number;
  status: string;
};
export type Coupon = {
  id: string;
  code: string;
  discount_cents: number;
  minimum_cents: number;
  max_uses: number;
  uses: number;
  expires_at: string;
  active: boolean;
};
export type Review = {
  id: string;
  order_id: string;
  author_id: string;
  author_name: string;
  title: string;
  rating: number;
  body: string;
  created_at: string;
};
export const orderStatus: Record<CommerceOrder["status"], string> = {
  placed: "待接单",
  accepted: "已接单",
  ready: "待取货",
  completed: "已完成",
  cancelled: "已取消",
};
export const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

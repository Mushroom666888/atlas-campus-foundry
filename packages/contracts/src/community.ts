import { z } from "zod";

const tags = z
  .array(z.string().trim().min(1).max(20))
  .max(8)
  .default([])
  .transform((values) => [...new Set(values)]);
export const profileInput = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    school: z.string().trim().max(100).default(""),
    bio: z.string().trim().max(1200).default(""),
    tags,
  })
  .strict();
export const productCategories = [
  "交易市场",
  "校园服务",
  "内容社区",
  "教育学习",
  "活动社交",
  "其他",
] as const;
export const postCategories = [
  "产品分享",
  "经验交流",
  "寻找合作",
  "问题求助",
] as const;
export const productInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    tagline: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(5000),
    url: z
      .union([
        z.literal(""),
        z
          .url()
          .max(2048)
          .refine((value) => {
            const url = new URL(value);
            return (
              ["https:", "http:"].includes(url.protocol) &&
              !url.username &&
              !url.password
            );
          }, "仅支持不含凭据的 HTTP / HTTPS 地址"),
      ])
      .default(""),
    category: z.enum(productCategories),
    stage: z.enum(["构建中", "内测中", "已发布"]),
    tags,
  })
  .strict();
export const postInput = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(2).max(10000),
    category: z.enum(postCategories),
    tags,
  })
  .strict();
export const replyInput = z
  .object({ body: z.string().trim().min(1).max(3000) })
  .strict();
export type CreatorProfile = {
  id: string;
  display_name: string;
  school: string;
  bio: string;
  tags: string[];
  created_at: string;
};
export type CreatorProduct = z.infer<typeof productInput> & {
  id: string;
  owner_id: string;
  author_name: string;
  school: string;
  created_at: string;
  updated_at: string;
};
export type CommunityPost = z.infer<typeof postInput> & {
  id: string;
  author_id: string;
  author_name: string;
  school: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
};
export type CommunityReply = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
export type CommunityPage<T> = { items: T[]; page: number; hasMore: boolean };

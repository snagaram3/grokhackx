import { z } from "zod";

export const platformSchema = z.enum(["x", "reddit", "hn", "public"]);

export const postSchema = z.object({
  platform: platformSchema,
  title: z.string(),
  url: z.string(),
  score: z.number(),
  createdAt: z.string(),
  sourceApi: z.string().optional(),
  tool: z.string().optional(),
  collectedAt: z.string().optional(),
  geo: z
    .object({
      lat: z.number(),
      lon: z.number(),
      label: z.string(),
    })
    .optional(),
});

export const platformSliceSchema = z.object({
  score: z.number(),
  posts: z.array(postSchema),
});

export const clusteredTopicSchema = z.object({
  id: z.string(),
  label: z.string(),
  platforms: z.object({
    x: platformSliceSchema,
    reddit: platformSliceSchema,
    hn: platformSliceSchema,
    public: platformSliceSchema.optional().default({ score: 0, posts: [] }),
  }),
});

export const clusteredListSchema = z.object({
  topics: z.array(clusteredTopicSchema).min(1).max(24),
});

export const xTrendSchema = z.object({
  topic: z.string(),
  volume: z.coerce.number().transform((n) => Math.max(0, Math.min(100, n))),
  urls: z.array(z.string()).max(3).default([]),
});

export const xTrendListSchema = z.object({
  topics: z.array(xTrendSchema).max(15),
});

export const whyItemSchema = z.object({
  id: z.string(),
  why: z.string().min(1).transform((s) => s.slice(0, 280)),
});

export const whyListSchema = z.object({
  why: z.array(whyItemSchema).max(24),
});

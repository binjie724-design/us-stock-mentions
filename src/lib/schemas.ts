import { z } from 'zod'

export const contentTypeSchema = z.union([z.literal('post'), z.literal('comment')])

export const stockMappingSchema = z.object({
  ticker: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  company_english_name: z.string().trim().min(1),
  company_chinese_name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  sector: z.string().trim().optional(),
})

export const stockConfigSchema = z.array(stockMappingSchema)

export const keywordConfigSchema = z.array(z.string().trim().min(1))

export const rankingModeSchema = z.union([
  z.literal('weighted'),
  z.literal('total_mentions'),
  z.literal('unique_post_mentions'),
  z.literal('unique_comment_mentions'),
])

export const windowPresetSchema = z.union([
  z.literal('7d'),
  z.literal('14d'),
  z.literal('30d'),
  z.literal('custom'),
])

export const redditSourceConfigSchema = z.object({
  subreddits: z.array(z.string().trim().min(1)).min(1),
  queries: z.array(z.string().trim().min(1)).min(1),
  sort: z
    .union([
      z.literal('relevance'),
      z.literal('hot'),
      z.literal('top'),
      z.literal('new'),
      z.literal('comments'),
    ])
    .default('new'),
  time: z
    .union([
      z.literal('hour'),
      z.literal('day'),
      z.literal('week'),
      z.literal('month'),
      z.literal('year'),
      z.literal('all'),
    ])
    .default('month'),
  limitPerQuery: z.number().int().min(1).max(100).default(25),
  includeComments: z.boolean().default(false),
  commentLimit: z.number().int().min(1).max(500).default(50),
})

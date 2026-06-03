export type ContentType = 'post' | 'comment'

export type RankingMode =
  | 'weighted'
  | 'total_mentions'
  | 'unique_post_mentions'
  | 'unique_comment_mentions'

export type WindowPreset = '7d' | '14d' | '30d' | 'custom'

export type TrendDirection = 'up' | 'down' | 'flat' | 'new'

export type IssueSeverity = 'error' | 'warning'

export interface ImportIssue {
  row: number
  field?: string
  severity: IssueSeverity
  message: string
}

export interface ContentRecord {
  id: string
  post_id: string
  content_type: ContentType
  source_platform?: 'xhs' | 'reddit' | 'mock' | 'other'
  source_name?: string
  title?: string
  body?: string
  comment_text?: string
  created_at?: string
  source_url?: string
  likes?: number
  comments?: number
  saves?: number
}

export interface RedditSourceConfig {
  subreddits: string[]
  queries: string[]
  sort: 'relevance' | 'hot' | 'top' | 'new' | 'comments'
  time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'
  limitPerQuery: number
  includeComments: boolean
  commentLimit: number
}

export interface StockMapping {
  ticker: string
  company_english_name: string
  company_chinese_name: string
  aliases: string[]
  sector?: string
}

export interface RecordMention {
  ticker: string
  hit_terms: string[]
  occurrences: number
}

export interface AnalysisOptions {
  windowPreset: WindowPreset
  rankingMode: RankingMode
  customStart?: string
  customEnd?: string
  asOf?: string
  keywords: string[]
}

export interface RankedStockMention {
  rank: number
  ticker: string
  company_english_name: string
  company_chinese_name: string
  sector?: string
  total_mentions: number
  unique_post_mentions: number
  unique_comment_mentions: number
  weighted_score: number
  recent_boost: number
  hit_terms: string[]
  trend_direction: TrendDirection
  sample_snippets: string[]
}

export interface AnalysisSummary {
  asOf: string
  windowStart: string
  windowEnd: string
  previousWindowStart: string
  previousWindowEnd: string
  scannedRecords: number
  inWindowRecords: number
  scopeMatchedRecords: number
  excludedUndatedRecords: number
  rankingMode: RankingMode
}

export interface AnalysisResult {
  summary: AnalysisSummary
  results: RankedStockMention[]
}

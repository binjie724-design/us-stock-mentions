import type { ContentRecord, RedditSourceConfig } from './types'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

interface RedditTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

interface RedditThing<T> {
  kind: string
  data: T
}

interface RedditListing<T> {
  kind: string
  data: {
    children: Array<RedditThing<T>>
    after?: string | null
  }
}

interface RedditPostData {
  id: string
  name?: string
  subreddit?: string
  title?: string
  selftext?: string
  created_utc?: number
  permalink?: string
  score?: number
  num_comments?: number
}

interface RedditCommentData {
  id: string
  name?: string
  link_id?: string
  body?: string
  created_utc?: number
  permalink?: string
  score?: number
  replies?: RedditListing<RedditCommentData> | string
}

export interface RedditCredentials {
  clientId: string
  clientSecret: string
  userAgent: string
}

export interface RedditConnectorOptions {
  credentials: RedditCredentials
  config: RedditSourceConfig
  fetchImpl?: FetchLike
}

const redditBaseUrl = 'https://oauth.reddit.com'
const tokenUrl = 'https://www.reddit.com/api/v1/access_token'

function base64Ascii(input: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''

  for (let index = 0; index < input.length; index += 3) {
    const first = input.charCodeAt(index)
    const second = input.charCodeAt(index + 1)
    const third = input.charCodeAt(index + 2)
    const hasSecond = index + 1 < input.length
    const hasThird = index + 2 < input.length
    const triplet = (first << 16) | ((hasSecond ? second : 0) << 8) | (hasThird ? third : 0)

    output += alphabet[(triplet >> 18) & 63]
    output += alphabet[(triplet >> 12) & 63]
    output += hasSecond ? alphabet[(triplet >> 6) & 63] : '='
    output += hasThird ? alphabet[triplet & 63] : '='
  }

  return output
}

function requireSafeSubredditName(subreddit: string): string {
  const trimmed = subreddit.trim()
  if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
    throw new Error(`Invalid subreddit name: ${subreddit}`)
  }
  return trimmed
}

function toRedditUrl(permalink?: string): string | undefined {
  if (!permalink) {
    return undefined
  }
  return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`
}

function utcSecondsToIso(value?: number): string | undefined {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : undefined
}

export function mapRedditPostToRecord(post: RedditPostData, subreddit: string): ContentRecord {
  const postFullName = post.name ?? `t3_${post.id}`
  return {
    id: `reddit:post:${postFullName}`,
    post_id: postFullName,
    content_type: 'post',
    source_platform: 'reddit',
    source_name: `r/${post.subreddit ?? subreddit}`,
    title: post.title,
    body: post.selftext,
    created_at: utcSecondsToIso(post.created_utc),
    source_url: toRedditUrl(post.permalink),
    likes: post.score,
    comments: post.num_comments,
  }
}

export function mapRedditCommentToRecord(
  comment: RedditCommentData,
  postFullName: string,
  subreddit: string,
): ContentRecord {
  const commentFullName = comment.name ?? `t1_${comment.id}`
  return {
    id: `reddit:comment:${commentFullName}`,
    post_id: postFullName,
    content_type: 'comment',
    source_platform: 'reddit',
    source_name: `r/${subreddit}`,
    comment_text: comment.body,
    created_at: utcSecondsToIso(comment.created_utc),
    source_url: toRedditUrl(comment.permalink),
    likes: comment.score,
  }
}

function collectComments(
  listing: RedditListing<RedditCommentData>,
  postFullName: string,
  subreddit: string,
  limit: number,
  output: ContentRecord[],
): void {
  for (const child of listing.data.children) {
    if (output.length >= limit || child.kind === 'more' || !child.data?.id) {
      continue
    }

    output.push(mapRedditCommentToRecord(child.data, postFullName, subreddit))

    if (typeof child.data.replies !== 'string' && child.data.replies?.data?.children) {
      collectComments(child.data.replies, postFullName, subreddit, limit, output)
    }
  }
}

async function parseRedditJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text()

  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after')
    const retryHint = retryAfter ? ` Retry after ${retryAfter} seconds.` : ''
    throw new Error(`Reddit API ${label} failed with HTTP ${response.status}.${retryHint} ${text}`)
  }

  return JSON.parse(text) as T
}

export class RedditDataApiConnector {
  private readonly credentials: RedditCredentials
  private readonly config: RedditSourceConfig
  private readonly fetchImpl: FetchLike

  constructor(options: RedditConnectorOptions) {
    this.credentials = options.credentials
    this.config = options.config
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async load(): Promise<ContentRecord[]> {
    const accessToken = await this.getAccessToken()
    const records = new Map<string, ContentRecord>()

    for (const subredditInput of this.config.subreddits) {
      const subreddit = requireSafeSubredditName(subredditInput)

      for (const query of this.config.queries) {
        const posts = await this.searchPosts(accessToken, subreddit, query)

        for (const post of posts) {
          const postRecord = mapRedditPostToRecord(post, subreddit)
          records.set(postRecord.id, postRecord)

          if (this.config.includeComments) {
            const comments = await this.fetchComments(
              accessToken,
              post.id,
              postRecord.post_id,
              post.subreddit ?? subreddit,
            )
            comments.forEach((comment) => records.set(comment.id, comment))
          }
        }
      }
    }

    return [...records.values()].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
  }

  private async getAccessToken(): Promise<string> {
    const response = await this.fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${base64Ascii(
          `${this.credentials.clientId}:${this.credentials.clientSecret}`,
        )}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.credentials.userAgent,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    })

    const token = await parseRedditJson<RedditTokenResponse>(response, 'token request')
    if (!token.access_token) {
      throw new Error('Reddit token response did not include access_token.')
    }
    return token.access_token
  }

  private async searchPosts(
    accessToken: string,
    subreddit: string,
    query: string,
  ): Promise<RedditPostData[]> {
    const url = new URL(`${redditBaseUrl}/r/${subreddit}/search`)
    url.searchParams.set('q', query)
    url.searchParams.set('restrict_sr', '1')
    url.searchParams.set('sort', this.config.sort)
    url.searchParams.set('t', this.config.time)
    url.searchParams.set('limit', String(this.config.limitPerQuery))
    url.searchParams.set('raw_json', '1')
    url.searchParams.set('type', 'link')

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': this.credentials.userAgent,
      },
    })

    const listing = await parseRedditJson<RedditListing<RedditPostData>>(
      response,
      `search r/${subreddit}`,
    )
    return listing.data.children.map((child) => child.data).filter((post) => Boolean(post.id))
  }

  private async fetchComments(
    accessToken: string,
    postId: string,
    postFullName: string,
    subreddit: string,
  ): Promise<ContentRecord[]> {
    const url = new URL(`${redditBaseUrl}/comments/${postId}`)
    url.searchParams.set('limit', String(this.config.commentLimit))
    url.searchParams.set('depth', '8')
    url.searchParams.set('raw_json', '1')

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': this.credentials.userAgent,
      },
    })

    const payload = await parseRedditJson<Array<RedditListing<RedditCommentData>>>(
      response,
      `comments ${postId}`,
    )
    const commentsListing = payload[1]
    const comments: ContentRecord[] = []

    if (commentsListing?.data?.children) {
      collectComments(commentsListing, postFullName, subreddit, this.config.commentLimit, comments)
    }

    return comments
  }
}

/**
 * lib/chat-mentions.ts
 *
 * Pure text logic behind chat notification routing: reading mention scopes out
 * of a message, flattening rich text for previews, and matching keyword
 * highlights. Deliberately free of imports so it can be reasoned about and
 * tested in isolation from the database and the push pipeline.
 */

export type MentionScope = 'NONE' | 'USERS' | 'HERE' | 'CHANNEL' | 'EVERYONE'

/** Scopes that address a group rather than a list of named people. */
export const BROADCAST_SCOPES: MentionScope[] = ['HERE', 'CHANNEL', 'EVERYONE']

/**
 * A person mention is stored inline as `@[Display Name](userId)`.
 *
 * Carrying the id in the message body rather than only in a side column means a
 * mention survives editing and quoting, the server can resolve it without
 * trusting the client, and the renderer knows exactly where the name ends —
 * which guessing at `@word` boundaries cannot do for multi-word names.
 */
const MENTION_TOKEN = /([@#])\[([^\]]+)\]\(([^)]+)\)/g

/** Broadcast words, which address a group and so carry no id. */
const BROADCAST_WORDS = ['everyone', 'channel', 'here'] as const

/** Formats a mention for insertion into message text. */
export function formatMentionToken(display: string, userId: string): string {
  return `@[${display}](${userId})`
}

/** User ids mentioned in the message body. The authoritative server-side read. */
export function parseMentionedIds(content: string): string[] {
  const ids = new Set<string>()
  for (const match of content.matchAll(MENTION_TOKEN)) {
    const [, sigil, , id] = match
    if (sigil === '@' && id) ids.add(id)
  }
  return [...ids]
}

/**
 * Reads the broadcast scope out of the message text. `@everyone` outranks
 * `@channel`, which outranks `@here`, matching how Slack treats overlapping
 * broadcasts. Explicitly named people are collected in the client, which knows
 * the id behind each mention, and passed in via `hasNamedMentions`.
 */
export function parseMentionScope(text: string, hasNamedMentions: boolean): MentionScope {
  const lowered = text.toLowerCase()
  if (/(^|\s)@everyone\b/.test(lowered)) return 'EVERYONE'
  if (/(^|\s)@channel\b/.test(lowered)) return 'CHANNEL'
  if (/(^|\s)@here\b/.test(lowered)) return 'HERE'
  return hasNamedMentions ? 'USERS' : 'NONE'
}

/** Strips HTML so previews and keyword matching see what the reader sees. */
export function toPlainText(content: string): string {
  return content
    // Collapse mention tokens to how they read, so a notification preview says
    // "@Alice" rather than "@[Alice](clx123…)".
    .replace(MENTION_TOKEN, (_m, sigil, display) => `${sigil}${display}`)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Word-boundary keyword match, so "dev" does not fire on "device". */
export function matchesKeyword(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const lowered = text.toLowerCase()
  return keywords.some(keyword => {
    const term = keyword.trim().toLowerCase()
    if (!term) return false
    return new RegExp(`(^|\\W)${escapeRegExp(term)}(\\W|$)`).test(lowered)
  })
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Rewrites mention tokens and broadcast words in rich-text message HTML into
 * styled pills.
 *
 * Walks tags and text separately so a replacement can never land inside an
 * attribute — a naive global regex would happily corrupt an `href` containing an
 * `@`. Only ever wraps text that is already in the document, so nothing
 * unescaped is introduced.
 */
export function highlightMentionsHtml(html: string, currentUserId?: string): string {
  if (!html) return html

  return html.replace(/(<[^>]+>)|([^<]+)/g, (_match, tag: string, text: string) => {
    if (tag) return tag
    if (!text) return ''

    let out = text.replace(MENTION_TOKEN, (_m, sigil: string, display: string, id: string) => {
      const isSelf = !!currentUserId && id === currentUserId
      const cls = isSelf ? 'chat-mention chat-mention-self' : 'chat-mention'
      return `<span class="${cls}" data-mention-id="${escapeHtmlAttribute(id)}">${sigil}${display}</span>`
    })

    // Broadcasts have no id, so they are matched as words. The leading boundary
    // keeps "bob@channel.com" from being mistaken for a broadcast.
    out = out.replace(
      new RegExp(`(^|[\\s(>])@(${BROADCAST_WORDS.join('|')})\\b`, 'gi'),
      (_m, prefix: string, word: string) =>
        `${prefix}<span class="chat-mention chat-mention-broadcast">@${word}</span>`,
    )

    return out
  })
}

/** Notification body: a short, single-line version of the message. */
export function buildPreview(text: string, hasAttachment: boolean): string {
  const trimmed = text.trim()
  if (!trimmed) return hasAttachment ? 'Sent an attachment' : 'Sent a message'
  return trimmed.length > 140 ? `${trimmed.slice(0, 139)}…` : trimmed
}

/** Notification title, phrased by where the message landed and why it matters. */
export function buildTitle(
  senderName: string,
  conversation: { is_group: boolean; name: string | null },
  isMention: boolean,
  scope: MentionScope,
  isThreadReply?: boolean,
): string {
  if (isThreadReply) {
    return isMention
      ? `${senderName} mentioned you in a thread`
      : `${senderName} replied in a thread`
  }

  if (!conversation.is_group) return senderName

  const channel = conversation.name ? `#${conversation.name}` : 'a channel'
  if (isMention && BROADCAST_SCOPES.includes(scope)) {
    return `${senderName} notified ${channel}`
  }
  if (isMention) return `${senderName} mentioned you in ${channel}`
  return `${senderName} in ${channel}`
}

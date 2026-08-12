'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'

// 1. Fetch all conversations for the current user
export async function getConversations() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    // Ensure General channel exists and user is in it
    await getOrCreateGeneralChannel()

    const conversations = await prisma.chatConversation.findMany({
      where: {
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, image: true, email: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get the latest message for preview
          include: {
            sender: {
              select: { id: true, name: true }
            }
          }
        },
        project: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Calculate unread counts
    const lastReadIds = conversations.flatMap(c => 
      c.participants
        .filter(p => p.user_id === session.user.id)
        .map(p => p.last_read_message_id)
        .filter(Boolean)
    )

    let lastReadMap = new Map<string, Date>()
    if (lastReadIds.length > 0) {
      const lastReadMessages = await prisma.chatMessage.findMany({
        where: { id: { in: lastReadIds as string[] } },
        select: { id: true, createdAt: true }
      })
      lastReadMap = new Map(lastReadMessages.map(m => [m.id, m.createdAt]))
    }

    // Unread and mention counts are separate numbers because they mean
    // different things: unread drives bold text, mentions drive the badge.
    const counts = await Promise.all(conversations.map(async c => {
      const participant = c.participants.find(p => p.user_id === session.user.id)
      if (!participant) return { unreadCount: 0, mentionCount: 0 }

      let afterDate = participant.joined_at
      if (participant.last_read_message_id) {
        const lastReadDate = lastReadMap.get(participant.last_read_message_id)
        if (lastReadDate) afterDate = lastReadDate
      }

      const unreadWhere = {
        conversation_id: c.id,
        createdAt: { gt: afterDate },
        sender_id: { not: session.user.id },
      }

      const [unreadCount, mentionCount] = await Promise.all([
        prisma.chatMessage.count({ where: unreadWhere }),
        prisma.chatMessage.count({
          where: {
            ...unreadWhere,
            OR: [
              { mentioned_user_ids: { has: session.user.id } },
              { mention_scope: { in: ['HERE', 'CHANNEL', 'EVERYONE'] } },
            ],
          },
        }),
      ])

      return { unreadCount, mentionCount }
    }))

    const conversationsWithUnread = conversations.map((conv, idx) => {
      const participant = conv.participants.find(p => p.user_id === session.user.id)
      const mutedUntil = participant?.muted_until ?? null
      return {
        ...conv,
        unreadCount:  counts[idx].unreadCount,
        mentionCount: counts[idx].mentionCount,
        notifyLevel:  participant?.notify_level ?? 'MENTIONS',
        mutedUntil,
        isMuted: participant?.notify_level === 'NONE' ||
                 (mutedUntil !== null && mutedUntil > new Date()),
      }
    })

    return { success: true, conversations: conversationsWithUnread }
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return { success: false, error: 'Failed to fetch conversations' }
  }
}

// 2. Fetch messages for a specific conversation
export async function getMessages(conversationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    // Verify user is part of the conversation
    const isParticipant = await prisma.chatParticipant.findFirst({
      where: { conversation_id: conversationId, user_id: session.user.id }
    })

    if (!isParticipant) {
      return { success: false, error: 'Not a participant' }
    }

    const messages = await prisma.chatMessage.findMany({
      where: { 
        conversation_id: conversationId,
        // Only fetch top-level messages (not thread replies)
        OR: [
          { reply_to_id: null },
          { reply_to: { conversation_id: conversationId } }
        ]
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true }
        },
        reply_to: {
          include: {
            sender: { select: { id: true, name: true } }
          }
        },
        replies: {
          select: {
            id: true,
            sender_id: true,
            sender: { select: { id: true, name: true, image: true } },
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return { success: true, messages }
  } catch (error) {
    console.error('Error fetching messages:', error)
    return { success: false, error: 'Failed to fetch messages' }
  }
}

// 3. Send a new message
export async function sendMessage(
  conversationId: string,
  content: string,
  attachmentUrl?: string,
  replyToId?: string,
  mentionedUserIds?: string[],
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const { parseMentionScope, toPlainText, parseMentionedIds, notifyChatMessage } =
      await import('@/lib/chat-notifications')

    const text = toPlainText(content)
    // Mentions are read out of the message body, which is authoritative — then
    // narrowed to actual participants so a crafted request cannot notify
    // arbitrary users. The client argument is accepted only as a fallback for
    // callers that have not been updated.
    const namedIds = await filterToParticipants(
      conversationId,
      [...parseMentionedIds(content), ...(mentionedUserIds ?? [])],
      session.user.id,
    )
    const mentionScope = parseMentionScope(text, namedIds.length > 0)

    const message = await prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        sender_id: session.user.id,
        content,
        attachment_url: attachmentUrl || null,
        reply_to_id: replyToId || null,
        mentioned_user_ids: namedIds,
        mention_scope: mentionScope,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true }
        },
        reply_to: {
          include: {
            sender: { select: { id: true, name: true } }
          }
        }
      }
    })

    // Update conversation timestamp
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })

    // Never let a notification failure fail the send.
    await notifyChatMessage({
      conversationId,
      messageId:        message.id,
      senderId:         session.user.id,
      senderName:       message.sender?.name || session.user.name || 'Someone',
      text:             text || (attachmentUrl ? 'Sent an attachment' : ''),
      mentionedUserIds: namedIds,
      mentionScope,
      orgId:            session.user.orgId,
    })

    return { success: true, message }
  } catch (error) {
    console.error('Error sending message:', error)
    return { success: false, error: 'Failed to send message' }
  }
}

/**
 * Narrows client-supplied mention ids to real participants of the conversation,
 * excluding the sender. Mentions are resolved in the browser (which knows the id
 * behind each name), so they must be re-checked here before they can direct a
 * notification at anyone.
 */
async function filterToParticipants(
  conversationId: string,
  candidateIds: string[] | undefined,
  senderId: string,
): Promise<string[]> {
  if (!candidateIds?.length) return []

  const unique = [...new Set(candidateIds)].filter(id => id && id !== senderId)
  if (unique.length === 0) return []

  const participants = await prisma.chatParticipant.findMany({
    where:  { conversation_id: conversationId, user_id: { in: unique } },
    select: { user_id: true },
  })

  return participants.map(p => p.user_id)
}

// 4. Create or get a 1-on-1 DM conversation
export async function getOrCreateDM(otherUserId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
    
    if (session.user.id === otherUserId) {
      return { success: false, error: 'Cannot DM yourself' }
    }

    // Find existing DM between these two users
    const existing = await prisma.chatConversation.findFirst({
      where: {
        is_group: false,
        AND: [
          { participants: { some: { user_id: session.user.id } } },
          { participants: { some: { user_id: otherUserId } } }
        ]
      }
    })

    if (existing) {
      return { success: true, conversationId: existing.id }
    }

    // Create new DM. Direct messages notify on every message; only group
    // channels default to mentions-only.
    const newConv = await prisma.chatConversation.create({
      data: {
        is_group: false,
        participants: {
          create: [
            { user_id: session.user.id, notify_level: 'ALL' },
            { user_id: otherUserId, notify_level: 'ALL' }
          ]
        }
      }
    })

    return { success: true, conversationId: newConv.id }
  } catch (error) {
    console.error('Error creating DM:', error)
    return { success: false, error: 'Failed to create DM' }
  }
}

// 5. Fetch all users for starting new DMs
export async function getChatUsers() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        orgId: session.user.orgId,
        isSuperAdmin: false,
        role: {
          name: { not: 'Super Admin' }
        }
      },
      select: {
        id: true,
        name: true,
        image: true,
        role: true
      },
      orderBy: { name: 'asc' }
    })

    return { success: true, users }
  } catch (error) {
    console.error('Error fetching chat users:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}

// 6. Ensure General channel exists and user is a participant
export async function getOrCreateGeneralChannel() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    let general = await prisma.chatConversation.findFirst({
      where: {
        is_group: true,
        name: 'General',
        orgId: session.user.orgId
      }
    })

    if (!general) {
      general = await prisma.chatConversation.create({
        data: {
          is_group: true,
          name: 'General',
          orgId: session.user.orgId,
        }
      })
    }

    // Check if user is participant
    const isParticipant = await prisma.chatParticipant.findFirst({
      where: {
        conversation_id: general.id,
        user_id: session.user.id
      }
    })

    if (!isParticipant) {
      await prisma.chatParticipant.create({
        data: {
          conversation_id: general.id,
          user_id: session.user.id
        }
      })
    }

    return { success: true, conversationId: general.id }
  } catch (error) {
    console.error('Error with General channel:', error)
    return { success: false, error: 'Failed' }
  }
}

// 7. Search tasks for # mentions
export async function searchTasks(query: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const isAdmin = session.user.role === 'admin'

    const tasks = await prisma.task.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
        project: {
          orgId: session.user.orgId
        },
        ...(isAdmin ? {} : {
          OR: [
            { assigned_member_ids: { has: session.user.id } },
            { assigned_by: session.user.id },
            { project: { assigned_member_ids: { has: session.user.id } } },
            { project: { team_lead_id: session.user.id } }
          ]
        })
      },
      select: {
        id: true,
        title: true,
        status: true,
        project: { select: { name: true } }
      },
      take: 5
    })

    return { success: true, tasks }
  } catch (error) {
    console.error('Error searching tasks:', error)
    return { success: false, error: 'Failed' }
  }
}

// 8. Convert message to task
export async function convertMessageToTask(content: string, projectId: string | null = null) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    // Prevent duplicate tasks by checking if a task with the exact same content already exists
    const existingTask = await prisma.task.findFirst({
      where: {
        description: content,
        project_id: projectId || undefined,
      }
    })

    if (existingTask) {
      return { success: false, error: 'This message has already been converted to a task.' }
    }

    const task = await prisma.task.create({
      data: {
        title: content.length > 50 ? content.substring(0, 50) + '...' : content,
        description: content,
        project_id: projectId || undefined,
        assigned_member_ids: [session.user.id],
        assigned_by: session.user.id,
      }
    })

    return { success: true, taskId: task.id }
  } catch (error) {
    console.error('Error converting message to task:', error)
    return { success: false, error: 'Failed' }
  }
}

// 9. Create a new Channel
export async function createChannel(name: string, memberIds: string[]) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const allMembers = Array.from(new Set([...memberIds, session.user.id]))

    const conversation = await prisma.chatConversation.create({
      data: {
        name,
        is_group: true,
        orgId: session.user.orgId,
        participants: {
          create: allMembers.map(id => ({ user_id: id }))
        }
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, image: true } } }
        }
      }
    })

    return { success: true, conversation }
  } catch (error) {
    console.error('Error creating channel:', error)
    return { success: false, error: 'Failed' }
  }
}

// 10. Pin Message
export async function pinMessage(messageId: string, isPinned: boolean) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
    const msg = await prisma.chatMessage.update({ where: { id: messageId }, data: { is_pinned: isPinned } })
    return { success: true, message: msg }
  } catch (error) {
    return { success: false, error: 'Failed to pin message' }
  }
}

// 11. Toggle Reaction
export async function toggleReaction(messageId: string, emoji: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } })
    if (!msg) return { success: false, error: 'Not found' }
    const currentReactions: any = msg.reactions || {}
    let hadOtherEmoji = false

    // Remove user from all emojis first
    for (const [key, users] of Object.entries(currentReactions)) {
      const userList = (users as string[]) || []
      const filtered = userList.filter((id: string) => id !== session.user.id)
      
      // Check if they already had THIS specific emoji
      if (key === emoji && userList.length !== filtered.length) {
        hadOtherEmoji = true // This means they clicked the same emoji they already had (toggling off)
      }
      
      if (filtered.length > 0) {
        currentReactions[key] = filtered
      } else {
        delete currentReactions[key]
      }
    }

    // If they didn't just toggle off their existing emoji, add the new one
    if (!hadOtherEmoji) {
      currentReactions[emoji] = [...(currentReactions[emoji] || []), session.user.id]
    }

    const updatedMsg = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions: currentReactions }
    })
    return { success: true, message: updatedMsg }
  } catch (error) {
    return { success: false, error: 'Failed to react' }
  }
}

// 12. Add Group Member
export async function addGroupMember(conversationId: string, userId: string) {
  try {
    await prisma.chatParticipant.create({ data: { conversation_id: conversationId, user_id: userId } })
    return { success: true }
  } catch (error) { return { success: false, error: 'Failed to add member' } }
}

// 13. Remove Group Member
export async function removeGroupMember(conversationId: string, userId: string) {
  try {
    await prisma.chatParticipant.deleteMany({ where: { conversation_id: conversationId, user_id: userId } })
    return { success: true }
  } catch (error) { return { success: false, error: 'Failed to remove member' } }
}
// 14. Mark Conversation as Read
export async function markConversationAsRead(conversationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const latestMessage = await prisma.chatMessage.findFirst({
      where: { conversation_id: conversationId },
      orderBy: { createdAt: 'desc' }
    })

    if (latestMessage) {
      // Find the participant ID (composite key is mostly used, but since we have a unique constraint on [conversation_id, user_id]...)
      await prisma.chatParticipant.update({
        where: {
          conversation_id_user_id: {
            conversation_id: conversationId,
            user_id: session.user.id
          }
        },
        data: {
          last_read_message_id: latestMessage.id
        }
      })

      // Clear this conversation's banner from the user's other devices. Not
      // awaited for correctness — the read itself is already committed — but
      // awaited so the action does not resolve before the push is handed off.
      const { dismissConversationNotifications } = await import('@/lib/chat-notifications')
      await dismissConversationNotifications(session.user.id, conversationId)
    }

    return { success: true }
  } catch (error) {
    console.error('Error marking conversation as read:', error)
    return { success: false, error: 'Failed' }
  }
}

// 15. Get Global Unread Chat Count
export async function getGlobalUnreadChatCount() {
  try {
    const session = await auth()
    if (!session?.user?.id) return 0

    const conversations = await prisma.chatConversation.findMany({
      where: {
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      },
      select: {
        id: true,
        participants: {
          where: { user_id: session.user.id },
          select: { joined_at: true, last_read_message_id: true }
        }
      }
    })

    let totalUnread = 0

    // To minimize queries, we'll fetch all last read message timestamps at once
    const lastReadIds = conversations
      .map(c => c.participants[0]?.last_read_message_id)
      .filter(Boolean) as string[]
      
    let lastReadMap = new Map<string, Date>()
    if (lastReadIds.length > 0) {
      const lastReadMessages = await prisma.chatMessage.findMany({
        where: { id: { in: lastReadIds } },
        select: { id: true, createdAt: true }
      })
      lastReadMap = new Map(lastReadMessages.map(m => [m.id, m.createdAt]))
    }

    for (const c of conversations) {
      const p = c.participants[0]
      if (!p) continue
      
      let afterDate = p.joined_at
      if (p.last_read_message_id) {
        const d = lastReadMap.get(p.last_read_message_id)
        if (d) afterDate = d
      }
      
      const count = await prisma.chatMessage.count({
        where: {
          conversation_id: c.id,
          createdAt: { gt: afterDate },
          sender_id: { not: session.user.id }
        }
      })
      totalUnread += count
    }

    return totalUnread
  } catch (error) {
    console.error('Error fetching global unread count:', error)
    return 0
  }
}

// 16. Edit Message
export async function editMessage(messageId: string, newContent: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } })
    if (!msg) return { success: false, error: 'Message not found' }
    if (msg.sender_id !== session.user.id) return { success: false, error: 'Can only edit your own messages' }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content: newContent,
        is_edited: true,
        edited_at: new Date()
      },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        reply_to: { include: { sender: { select: { id: true, name: true } } } }
      }
    })

    return { success: true, message: updated }
  } catch (error) {
    console.error('Error editing message:', error)
    return { success: false, error: 'Failed to edit message' }
  }
}

// 17. Delete Message (soft delete)
export async function deleteMessage(messageId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } })
    if (!msg) return { success: false, error: 'Message not found' }
    if (msg.sender_id !== session.user.id) return { success: false, error: 'Can only delete your own messages' }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        is_deleted: true,
        content: '',
        attachment_url: null,
        reactions: {}
      }
    })

    return { success: true, message: updated }
  } catch (error) {
    console.error('Error deleting message:', error)
    return { success: false, error: 'Failed to delete message' }
  }
}

// 18. Get Thread Replies
export async function getThreadReplies(parentMessageId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const replies = await prisma.chatMessage.findMany({
      where: { reply_to_id: parentMessageId },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        reply_to: { include: { sender: { select: { id: true, name: true } } } },
        replies: {
          select: {
            id: true,
            sender_id: true,
            sender: { select: { id: true, name: true, image: true } },
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return { success: true, replies }
  } catch (error) {
    console.error('Error fetching thread replies:', error)
    return { success: false, error: 'Failed to fetch replies' }
  }
}

// 19. Send Thread Reply
export async function sendThreadReply(
  parentMessageId: string,
  content: string,
  attachmentUrl?: string,
  alsoSendToChannel: boolean = false,
  mentionedUserIds?: string[],
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    // Get parent message to find conversation
    const parentMsg = await prisma.chatMessage.findUnique({
      where: { id: parentMessageId },
      select: { conversation_id: true }
    })
    if (!parentMsg) return { success: false, error: 'Parent message not found' }

    const { parseMentionScope, toPlainText, parseMentionedIds, notifyChatMessage, getThreadFollowers } =
      await import('@/lib/chat-notifications')

    const text = toPlainText(content)
    const namedIds = await filterToParticipants(
      parentMsg.conversation_id,
      [...parseMentionedIds(content), ...(mentionedUserIds ?? [])],
      session.user.id,
    )
    const mentionScope = parseMentionScope(text, namedIds.length > 0)

    // Followers must be read before the reply is written, or the sender ends up
    // in their own audience.
    const followers = await getThreadFollowers(parentMessageId)

    const reply = await prisma.chatMessage.create({
      data: {
        conversation_id: parentMsg.conversation_id,
        sender_id: session.user.id,
        content,
        attachment_url: attachmentUrl || null,
        reply_to_id: parentMessageId,
        mentioned_user_ids: namedIds,
        mention_scope: mentionScope,
      },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        reply_to: { include: { sender: { select: { id: true, name: true } } } }
      }
    })

    // Update conversation timestamp
    await prisma.chatConversation.update({
      where: { id: parentMsg.conversation_id },
      data: { updatedAt: new Date() }
    })

    await notifyChatMessage({
      conversationId:   parentMsg.conversation_id,
      messageId:        reply.id,
      senderId:         session.user.id,
      senderName:       reply.sender?.name || session.user.name || 'Someone',
      text:             text || (attachmentUrl ? 'Sent an attachment' : ''),
      mentionedUserIds: namedIds,
      mentionScope,
      orgId:            session.user.orgId,
      // "Also send to channel" promotes the reply to a normal channel message,
      // so it addresses everyone instead of only the thread's followers.
      restrictToUserIds: alsoSendToChannel ? undefined : followers,
      isThreadReply:     !alsoSendToChannel,
    })

    return { success: true, reply, conversationId: parentMsg.conversation_id, alsoSendToChannel }
  } catch (error) {
    console.error('Error sending thread reply:', error)
    return { success: false, error: 'Failed to send reply' }
  }
}

// 20. Get Pinned Messages for a Conversation
export async function getPinnedMessages(conversationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const pinned = await prisma.chatMessage.findMany({
      where: {
        conversation_id: conversationId,
        is_pinned: true,
        is_deleted: false
      },
      include: {
        sender: { select: { id: true, name: true, image: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, messages: pinned }
  } catch (error) {
    console.error('Error fetching pinned messages:', error)
    return { success: false, error: 'Failed to fetch pinned messages' }
  }
}

// 21. Search Messages Globally
export async function searchMessages(query: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    if (!query.trim()) return { success: true, messages: [] }

    const messages = await prisma.chatMessage.findMany({
      where: {
        content: { contains: query, mode: 'insensitive' },
        is_deleted: false,
        conversation: {
          participants: {
            some: { user_id: session.user.id }
          }
        }
      },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        conversation: {
          select: { id: true, name: true, is_group: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return { success: true, messages }
  } catch (error) {
    console.error('Error searching messages:', error)
    return { success: false, error: 'Failed to search messages' }
  }
}

// 22. Update Channel Description
export async function updateChannelDescription(conversationId: string, description: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { description }
    })

    return { success: true }
  } catch (error) {
    console.error('Error updating channel description:', error)
    return { success: false, error: 'Failed' }
  }
}

// 23. Per-conversation notification settings
export type ChatNotifyLevel = 'ALL' | 'MENTIONS' | 'NONE'

export async function getConversationNotifySettings(conversationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const participant = await prisma.chatParticipant.findFirst({
      where:  { conversation_id: conversationId, user_id: session.user.id },
      select: { notify_level: true, muted_until: true },
    })

    if (!participant) return { success: false, error: 'Not a participant' }

    return {
      success: true,
      level:      participant.notify_level as ChatNotifyLevel,
      mutedUntil: participant.muted_until,
    }
  } catch (error) {
    console.error('Error reading notify settings:', error)
    return { success: false, error: 'Failed' }
  }
}

export async function setConversationNotifyLevel(
  conversationId: string,
  level: ChatNotifyLevel,
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    if (!['ALL', 'MENTIONS', 'NONE'].includes(level)) {
      return { success: false, error: 'Invalid level' }
    }

    // updateMany scopes the write to this user's own participant row.
    const result = await prisma.chatParticipant.updateMany({
      where: { conversation_id: conversationId, user_id: session.user.id },
      data:  { notify_level: level },
    })

    if (result.count === 0) return { success: false, error: 'Not a participant' }
    return { success: true, level }
  } catch (error) {
    console.error('Error setting notify level:', error)
    return { success: false, error: 'Failed' }
  }
}

/**
 * Mutes a conversation for a period. Pass null to unmute. Separate from
 * notify_level so a timed mute doesn't lose the user's underlying preference.
 */
export async function muteConversation(conversationId: string, minutes: number | null) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    if (minutes !== null && (!Number.isFinite(minutes) || minutes <= 0)) {
      return { success: false, error: 'Invalid duration' }
    }

    const mutedUntil = minutes === null
      ? null
      : new Date(Date.now() + minutes * 60 * 1000)

    const result = await prisma.chatParticipant.updateMany({
      where: { conversation_id: conversationId, user_id: session.user.id },
      data:  { muted_until: mutedUntil },
    })

    if (result.count === 0) return { success: false, error: 'Not a participant' }
    return { success: true, mutedUntil }
  } catch (error) {
    console.error('Error muting conversation:', error)
    return { success: false, error: 'Failed' }
  }
}

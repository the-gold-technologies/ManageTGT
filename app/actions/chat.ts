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

    const unreadCounts = await Promise.all(conversations.map(async c => {
      const participant = c.participants.find(p => p.user_id === session.user.id)
      if (!participant) return 0
      
      let afterDate = participant.joined_at
      if (participant.last_read_message_id) {
        const lastReadDate = lastReadMap.get(participant.last_read_message_id)
        if (lastReadDate) afterDate = lastReadDate
      }
      
      return prisma.chatMessage.count({
        where: {
          conversation_id: c.id,
          createdAt: { gt: afterDate }
        }
      })
    }))

    const conversationsWithUnread = conversations.map((conv, idx) => ({
      ...conv,
      unreadCount: unreadCounts[idx]
    }))

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
      where: { conversation_id: conversationId },
      include: {
        sender: {
          select: { id: true, name: true, image: true }
        },
        reply_to: {
          include: {
            sender: { select: { id: true, name: true } }
          }
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
export async function sendMessage(conversationId: string, content: string, attachmentUrl?: string, replyToId?: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const message = await prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        sender_id: session.user.id,
        content,
        attachment_url: attachmentUrl || null,
        reply_to_id: replyToId || null
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

    return { success: true, message }
  } catch (error) {
    console.error('Error sending message:', error)
    return { success: false, error: 'Failed to send message' }
  }
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

    // Create new DM
    const newConv = await prisma.chatConversation.create({
      data: {
        is_group: false,
        participants: {
          create: [
            { user_id: session.user.id },
            { user_id: otherUserId }
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
          createdAt: { gt: afterDate }
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

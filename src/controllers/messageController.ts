import { Request, Response } from 'express';
import { db } from '../db';
import { conversationThreads, messages, users, bikes } from '../db/schema';
import { ConversationThread } from '../db/schema';
import { eq, and, or, desc, count, isNull } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/messages/conversations
 * Get all conversation threads for current user with unread count
 * Returns conversations sorted by last message timestamp
 */
export const getAllConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Fetch all threads where user is participant (simplified query)
    let allThreads: ConversationThread[] = [];
    try {
      allThreads = await db.query.conversationThreads.findMany({
        where: or(
          eq(conversationThreads.participant1Id, userId),
          eq(conversationThreads.participant2Id, userId)
        ),
        orderBy: [desc(conversationThreads.updatedAt)],
      });
    } catch (dbError) {
      console.error('[getAllConversations] Database error:', dbError);
      // If no conversations found (table might be empty but queryable)
      if (dbError instanceof Error && dbError.message.includes('does not exist')) {
        return res.status(500).json({
          success: false,
          message: 'Conversation threads table not found - database may not be properly initialized',
          error: dbError.message,
        });
      }
      // For other DB errors, treat as empty result
      allThreads = [];
    }

    if (!allThreads.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No conversations found',
      });
    }

    // Build response with unread count and partner info
    const conversationList = await Promise.all(
      allThreads.map(async (thread) => {
        // Fetch participant details
        const p1 = await db.query.users.findFirst({
          where: eq(users.id, thread.participant1Id),
          columns: { id: true, name: true, avatar: true, role: true },
        });

        const p2 = await db.query.users.findFirst({
          where: eq(users.id, thread.participant2Id),
          columns: { id: true, name: true, avatar: true, role: true },
        });

        // Determine partner (the other participant)
        const partner = thread.participant1Id === userId ? p2 : p1;

        // Fetch bike if exists
        let bikeData = null;
        if (thread.bikeId) {
          bikeData = await db.query.bikes.findFirst({
            where: eq(bikes.id, thread.bikeId),
            columns: { id: true, title: true, images: true },
            with: {
              brand: { columns: { id: true, name: true } },
              model: { columns: { id: true, name: true } },
            },
          });
        }

        // Fetch last message
        const lastMessages = await db.query.messages.findMany({
          where: eq(messages.threadId, thread.id),
          orderBy: [desc(messages.createdAt)],
          limit: 1,
        });

        const lastMsg = lastMessages[0]
          ? {
              id: lastMessages[0].id,
              content: lastMessages[0].content,
              fileUrl: lastMessages[0].fileUrl,
              isRead: lastMessages[0].isRead,
              createdAt: lastMessages[0].createdAt,
              isMine: lastMessages[0].senderId === userId,
            }
          : null;

        // Count unread messages received by current user
        const unreadResult = await db
          .select({ count: count() })
          .from(messages)
          .where(
            and(
              eq(messages.threadId, thread.id),
              eq(messages.receiverId, userId),
              eq(messages.isRead, false)
            )
          );

        const unreadCount = unreadResult[0]?.count || 0;

        return {
          threadId: thread.id,
          status: thread.status,
          partner,
          bike: bikeData,
          lastMessage: lastMsg,
          unreadCount,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: conversationList,
      message: 'Conversations fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/messages/:partnerId/:bikeId
 * Get detailed message history for specific thread (senderID, receiverID, bikeID all required)
 * All three parameters are mandatory - returns error if any is missing
 * Auto-marks messages as read for current user
 * Query params: page (default 1), limit (default 30)
 */
export const getConversationDetails = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { partnerId, bikeId } = req.params as { partnerId: string; bikeId: string };
    const { page = 1, limit = 30 } = req.query;

    // All three parameters (senderID, receiverID, bikeID) are required
    if (!partnerId || !bikeId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: partnerId and bikeId are mandatory',
      });
    }

    if (!UUID_REGEX.test(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID format' });
    }

    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({ success: false, message: 'Invalid bike ID format' });
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 30;
    const offset = (pageNum - 1) * limitNum;

    // Find exact thread matching senderID, receiverID, and bikeID
    const threadFilter = and(
      or(
        and(
          eq(conversationThreads.participant1Id, userId),
          eq(conversationThreads.participant2Id, partnerId)
        ),
        and(
          eq(conversationThreads.participant1Id, partnerId),
          eq(conversationThreads.participant2Id, userId)
        )
      ),
      eq(conversationThreads.bikeId, bikeId)
    );

    let thread;
    try {
      thread = await db.query.conversationThreads.findFirst({
        where: threadFilter,
      });
    } catch (dbError) {
      console.error('[getConversationDetails] Database error:', dbError);
      if (dbError instanceof Error && dbError.message.includes('does not exist')) {
        return res.status(500).json({
          success: false,
          message: 'Conversation threads table not found - database may not be properly initialized',
          error: dbError.message,
        });
      }
      throw dbError; // Re-throw other unexpected errors
    }

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Conversation thread not found for the specified participants and bike',
      });
    }

    // Fetch messages with pagination
    const threadMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, thread.id),
      with: {
        sender: { columns: { id: true, name: true, avatar: true } },
      },
      orderBy: [desc(messages.createdAt)],
      limit: limitNum,
      offset,
    });

    // Auto-mark messages as read for current user
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.threadId, thread.id),
          eq(messages.receiverId, userId),
          eq(messages.isRead, false)
        )
      );

    res.status(200).json({
      success: true,
      data: {
        threadId: thread.id,
        status: thread.status,
        messages: threadMessages.reverse(),
      },
      message: 'Conversation details fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching conversation details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/messages/:partnerId
 * Send message to partner with role-based constraints
 * BikeID is REQUIRED to form/access conversation thread
 * 
 * Constraints:
 * - buyer ↔ seller: can freely message
 * - buyer/seller → admin/inspector: can ONLY reply to existing thread (thread must be open)
 * - admin/inspector → anyone: can freely initiate
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const senderId = req.user!.userId;
    const senderRole = req.user!.role;
    const { partnerId } = req.params as { partnerId: string };
    const { content, bikeId } = req.body;
    const fileUrl = (req as any).fileUrl || null;

    if (!UUID_REGEX.test(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID format' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }

    if (senderId === partnerId) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    // Get receiver info
    const [receiver] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, partnerId))
      .limit(1);

    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    // Validate bikeId - REQUIRED for forming conversation thread
    if (!bikeId) {
      return res.status(400).json({ success: false, message: 'bikeId is required to form a conversation thread' });
    }

    const bid = String(bikeId);
    if (!UUID_REGEX.test(bid)) {
      return res.status(400).json({ success: false, message: 'Invalid bikeId format' });
    }

    const [bike] = await db.select({ id: bikes.id }).from(bikes).where(eq(bikes.id, bid)).limit(1);
    if (!bike) {
      return res.status(400).json({ success: false, message: 'Bike not found' });
    }
    const resolvedBikeId = bid;

    // Role-based constraint checks
    // buyer/seller cannot initiate to admin/inspector
    if (['buyer', 'seller'].includes(senderRole) && ['admin', 'inspector'].includes(receiver.role)) {
      // Check if existing thread exists and is open
      const existingThread = await db.query.conversationThreads.findFirst({
        where: or(
          and(
            eq(conversationThreads.participant1Id, senderId),
            eq(conversationThreads.participant2Id, partnerId)
          ),
          and(
            eq(conversationThreads.participant1Id, partnerId),
            eq(conversationThreads.participant2Id, senderId)
          )
        ),
      });

      if (!existingThread) {
        return res.status(403).json({
          success: false,
          message: 'You cannot initiate messages to admin/inspector. Only reply to their messages.',
        });
      }

      if (existingThread.status === 'closed') {
        return res.status(403).json({
          success: false,
          message: 'This conversation is closed. Wait for admin/inspector to reopen it.',
        });
      }
    }

    // Find or create thread (ordered so participant1 < participant2 for consistency)
    let threadId: string;
    const [p1, p2] = [senderId, partnerId].sort();

    const whereConditions = [
      eq(conversationThreads.participant1Id, p1),
      eq(conversationThreads.participant2Id, p2),
      eq(conversationThreads.bikeId, resolvedBikeId),
    ];

    const existingThread = await db.query.conversationThreads.findFirst({
      where: and(...whereConditions),
    });

    if (existingThread) {
      threadId = existingThread.id;
      // If thread was closed and admin/inspector is sending, auto-reopen it
      if (existingThread.status === 'closed' && ['admin', 'inspector'].includes(senderRole)) {
        await db
          .update(conversationThreads)
          .set({
            status: 'open',
            closedAt: null,
            closedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(conversationThreads.id, threadId));
      }
    } else {
      // Create new thread
      const [newThread] = await db
        .insert(conversationThreads)
        .values({
          participant1Id: p1,
          participant2Id: p2,
          bikeId: resolvedBikeId,
          status: 'open',
        })
        .returning();
      threadId = newThread.id;
    }

    // Insert message
    const [newMessage] = await db
      .insert(messages)
      .values({
        threadId,
        senderId,
        receiverId: partnerId,
        bikeId: resolvedBikeId,
        content: content.trim(),
        fileUrl,
        isRead: false,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: {
        ...newMessage,
        receiver: { id: receiver.id, role: receiver.role },
      },
      message: 'Message sent successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * DELETE /api/messages/:partnerId/close
 * Close conversation thread (admin/inspector only)
 * BikeID is REQUIRED to close specific thread
 * Once closed, buyer/seller cannot send messages until admin/inspector reopens
 */
export const closeConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { partnerId } = req.params as { partnerId: string };
    const { bikeId } = req.query;

    // Only admin/inspector can close conversations
    if (!['admin', 'inspector'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin/inspector can close conversations',
      });
    }

    if (!UUID_REGEX.test(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID format' });
    }

    // BikeID is REQUIRED to specify which thread to close
    if (!bikeId) {
      return res.status(400).json({ success: false, message: 'bikeId is required to close a conversation thread' });
    }

    const bid = String(bikeId);
    if (!UUID_REGEX.test(bid)) {
      return res.status(400).json({ success: false, message: 'Invalid bikeId format' });
    }

    const threadFilter = and(
      or(
        and(
          eq(conversationThreads.participant1Id, userId),
          eq(conversationThreads.participant2Id, partnerId)
        ),
        and(
          eq(conversationThreads.participant1Id, partnerId),
          eq(conversationThreads.participant2Id, userId)
        )
      ),
      eq(conversationThreads.bikeId, bid)
    );

    const finalFilter = threadFilter;

    const threadsToClose = await db.query.conversationThreads.findMany({
      where: finalFilter,
    });

    if (threadsToClose.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation thread not found for the specified participants and bike' });
    }

    // Close the specific thread
    const threadIds = threadsToClose.map((t) => t.id);
    await db
      .update(conversationThreads)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy: userId,
        updatedAt: new Date(),
      })
      .where(or(...threadIds.map((id) => eq(conversationThreads.id, id))));

    res.status(200).json({
      success: true,
      data: {
        threadId: threadsToClose[0].id,
        closedAt: new Date(),
      },
      message: 'Conversation thread closed successfully. Participant cannot send messages until reopened.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error closing conversation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/messages/system/all
 * Fetch all system messages (admin only)
 * Future feature: Show messages from admin across all conversations
 * Note: This is a placeholder for Tier 2+ expansion
 */
export const getAllSystemMessages = async (req: Request, res: Response) => {
  try {
    const userRole = req.user!.role;

    // Only admin can view all system messages
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view system messages',
      });
    }

    res.status(501).json({
      success: false,
      message: 'Feature not yet implemented - coming in future tier',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching system messages',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

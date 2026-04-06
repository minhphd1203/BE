import { pgTable, uuid, varchar, timestamp, integer, doublePrecision, text, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// User table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  avatar: text('avatar'),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
},
(table) => {
  return {
    emailRoleUnique: uniqueIndex('email_role_unique').on(table.email, table.role),
  };
});

// Category table
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Bike table
export const bikes = pgTable('bikes', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  brand: varchar('brand', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  price: doublePrecision('price').notNull(),
  condition: varchar('condition', { length: 50 }).notNull(),
  mileage: integer('mileage'),
  color: varchar('color', { length: 50 }),
  images: text('images').array().notNull().default([]),
  video: text('video'), // optional video URL
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, approved, rejected, hidden, reserved, sold
  isVerified: varchar('is_verified', { length: 20 }).default('not_verified'), // not_verified, verified, failed
  inspectionStatus: varchar('inspection_status', { length: 50 }).default('pending'), // pending, in_progress, completed
  categoryId: uuid('category_id').references(() => categories.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Transaction table
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  bikeId: uuid('bike_id').notNull().references(() => bikes.id),
  buyerId: uuid('buyer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  amount: doublePrecision('amount').notNull(), // Amount paid in this transaction
  transactionType: varchar('transaction_type', { length: 50 }).notNull().default('full_payment'), // full_payment, deposit
  remainingBalance: doublePrecision('remaining_balance'), // For deposits, the remaining amount to pay
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, approved, completed, cancelled
  paymentMethod: varchar('payment_method', { length: 50 }),
  notes: text('notes'),
  address: text('address'),
  fullName: text('full_name'),
  /** preparing | delivering | delivered — chỉ dùng khi đã thanh toán xong và xe sold */
  deliveryStatus: varchar('delivery_status', { length: 50 }),
  deliveryNotes: text('delivery_notes'),
  deliveredAt: timestamp('delivered_at'),
  receiptConfirmedAt: timestamp('receipt_confirmed_at'),
  deliveryUpdatedAt: timestamp('delivery_updated_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Inspection table
export const inspections = pgTable('inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  bikeId: uuid('bike_id').notNull().references(() => bikes.id),
  inspectorId: uuid('inspector_id').notNull().references(() => users.id),
  status: varchar('status', { length: 50 }).notNull().default('passed'), // passed, failed
  overallCondition: varchar('overall_condition', { length: 50 }).notNull(), // excellent, good, fair, poor
  frameCondition: varchar('frame_condition', { length: 50 }),
  brakeCondition: varchar('brake_condition', { length: 50 }),
  drivetrainCondition: varchar('drivetrain_condition', { length: 50 }),
  wheelCondition: varchar('wheel_condition', { length: 50 }),
  inspectionNote: text('inspection_note'),
  recommendation: text('recommendation'),
  inspectionImages: text('inspection_images').array().default([]),
  reportFile: text('report_file'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Report Reasons table (violation types)
export const reportReasons = pgTable('report_reasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  isSystemAutoResolvable: boolean('is_system_auto_resolvable').notNull().default(false),
  autoResolveAction: varchar('auto_resolve_action', { length: 100 }), // 'delete_bike', 'refund', etc.
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Report table
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  reportedUserId: uuid('reported_user_id').references(() => users.id),
  reportedBikeId: uuid('reported_bike_id').references(() => bikes.id),
  reasonId: uuid('reason_id').references(() => reportReasons.id), // NULL if "Others"
  reasonText: text('reason_text'), // Used when reasonId is NULL (Others option)
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, resolved, rejected
  resolution: text('resolution'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Wishlist table
export const wishlists = pgTable('wishlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bikeId: uuid('bike_id').notNull().references(() => bikes.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Conversation Threads table (tracks thread metadata)
// Thread identified by: participant1Id + participant2Id + bikeId
// This allows tracking thread status separately from individual messages
export const conversationThreads = pgTable('conversation_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  participant1Id: uuid('participant1_id').notNull().references(() => users.id), // First participant (can be any role)
  participant2Id: uuid('participant2_id').notNull().references(() => users.id), // Second participant (can be any role)
  bikeId: uuid('bike_id').references(() => bikes.id), // Context bike (optional, allows filtering threads by bike)
  status: varchar('status', { length: 50 }).notNull().default('open'), // 'open' or 'closed'
  closedAt: timestamp('closed_at'), // When thread was closed
  closedBy: uuid('closed_by').references(() => users.id), // Who closed it (admin/inspector)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Messages table (direct messaging between users with role-based constraints enforced in controller)
// Thread identified by: senderId + receiverId + bikeId (conversation_threads table handles thread metadata)
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => conversationThreads.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  receiverId: uuid('receiver_id').notNull().references(() => users.id),
  bikeId: uuid('bike_id').references(() => bikes.id), // context bike (optional, denormalized from thread for query convenience)
  content: text('content').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  // File attachment (image/document URL - optional)
  fileUrl: text('file_url'), // nullable, stores uploaded file URL
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Reviews table (buyer reviews seller after transaction)
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewerId: uuid('reviewer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  transactionId: uuid('transaction_id').references(() => transactions.id),
  rating: integer('rating').notNull(), // 1–5
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  bikes: many(bikes),
  purchasedTransactions: many(transactions, { relationName: 'buyer' }),
  soldTransactions: many(transactions, { relationName: 'seller' }),
  submittedReports: many(reports, { relationName: 'reporter' }),
  receivedReports: many(reports, { relationName: 'reportedUser' }),
  inspections: many(inspections),
  wishlists: many(wishlists),
  sentMessages: many(messages, { relationName: 'sender' }),
  receivedMessages: many(messages, { relationName: 'receiver' }),
  givenReviews: many(reviews, { relationName: 'reviewer' }),
  receivedReviews: many(reviews, { relationName: 'reviewedSeller' }),
  conversationThreadsAsParticipant1: many(conversationThreads, { relationName: 'participant1' }),
  conversationThreadsAsParticipant2: many(conversationThreads, { relationName: 'participant2' }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  bikes: many(bikes),
}));

export const reportReasonsRelations = relations(reportReasons, ({ many }) => ({
  reports: many(reports),
}));

export const conversationThreadsRelations = relations(conversationThreads, ({ one, many }) => ({
  participant1: one(users, {
    fields: [conversationThreads.participant1Id],
    references: [users.id],
    relationName: 'participant1',
  }),
  participant2: one(users, {
    fields: [conversationThreads.participant2Id],
    references: [users.id],
    relationName: 'participant2',
  }),
  bike: one(bikes, {
    fields: [conversationThreads.bikeId],
    references: [bikes.id],
  }),
  closedByUser: one(users, {
    fields: [conversationThreads.closedBy],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const bikesRelations = relations(bikes, ({ one, many }) => ({
  seller: one(users, {
    fields: [bikes.sellerId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [bikes.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
  reports: many(reports),
  inspections: many(inspections),
  wishlists: many(wishlists),
  messages: many(messages),
  conversationThreads: many(conversationThreads),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  bike: one(bikes, {
    fields: [transactions.bikeId],
    references: [bikes.id],
  }),
  buyer: one(users, {
    fields: [transactions.buyerId],
    references: [users.id],
    relationName: 'buyer',
  }),
  seller: one(users, {
    fields: [transactions.sellerId],
    references: [users.id],
    relationName: 'seller',
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: 'reporter',
  }),
  reportedUser: one(users, {
    fields: [reports.reportedUserId],
    references: [users.id],
    relationName: 'reportedUser',
  }),
  reportedBike: one(bikes, {
    fields: [reports.reportedBikeId],
    references: [bikes.id],
  }),
  reason: one(reportReasons, {
    fields: [reports.reasonId],
    references: [reportReasons.id],
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
  }),
}));

export const inspectionsRelations = relations(inspections, ({ one }) => ({
  bike: one(bikes, {
    fields: [inspections.bikeId],
    references: [bikes.id],
  }),
  inspector: one(users, {
    fields: [inspections.inspectorId],
    references: [users.id],
  }),
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, {
    fields: [wishlists.userId],
    references: [users.id],
  }),
  bike: one(bikes, {
    fields: [wishlists.bikeId],
    references: [bikes.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(conversationThreads, {
    fields: [messages.threadId],
    references: [conversationThreads.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: 'receiver',
  }),
  bike: one(bikes, {
    fields: [messages.bikeId],
    references: [bikes.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: 'reviewer',
  }),
  seller: one(users, {
    fields: [reviews.sellerId],
    references: [users.id],
    relationName: 'reviewedSeller',
  }),
  transaction: one(transactions, {
    fields: [reviews.transactionId],
    references: [transactions.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Bike = typeof bikes.$inferSelect;
export type NewBike = typeof bikes.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type Inspection = typeof inspections.$inferSelect;
export type NewInspection = typeof inspections.$inferInsert;

export type Wishlist = typeof wishlists.$inferSelect;
export type NewWishlist = typeof wishlists.$inferInsert;

export type ConversationThread = typeof conversationThreads.$inferSelect;
export type NewConversationThread = typeof conversationThreads.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

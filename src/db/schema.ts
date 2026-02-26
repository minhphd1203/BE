import { pgTable, uuid, varchar, timestamp, integer, doublePrecision, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// User table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  avatar: text('avatar'),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
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
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, approved, rejected
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
  amount: doublePrecision('amount').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, completed, cancelled
  paymentMethod: varchar('payment_method', { length: 50 }),
  notes: text('notes'),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Report table
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  reportedUserId: uuid('reported_user_id').references(() => users.id),
  reportedBikeId: uuid('reported_bike_id').references(() => bikes.id),
  reason: varchar('reason', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, resolved, rejected
  resolution: text('resolution'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
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
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  bikes: many(bikes),
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

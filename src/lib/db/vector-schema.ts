import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from 'drizzle-orm/pg-core';

export const vectorDocuments = pgTable('vector_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: text('company_id').notNull(),
  referenceType: text('reference_type').notNull(),
  referenceId: text('reference_id').notNull(),
  content: text('content').notNull(),
  embedding: jsonb('embedding').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

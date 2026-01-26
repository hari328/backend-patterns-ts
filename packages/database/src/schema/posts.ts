import { pgTable, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { snowflakeId } from '../utils/snowflake-column';
import { generateSnowflakeId } from '../utils/snowflake';
import { users } from './users';

export const posts = pgTable(
  'posts',
  {
    id: snowflakeId('id')
      .primaryKey()
      .$defaultFn(() => generateSnowflakeId()),
    userId: snowflakeId('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caption: text('caption').notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    commentsCount: integer('comments_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // Soft delete
  },
  (table) => ({
    userIdIdx: index('posts_user_id_idx').on(table.userId),
    createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
    deletedAtIdx: index('posts_deleted_at_idx').on(table.deletedAt),
  })
);


import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { snowflakeId } from '../utils/snowflake-column';
import { generateSnowflakeId } from '../utils/snowflake';
import { users } from './users';
import { posts } from './posts';

export const comments = pgTable(
  'comments',
  {
    id: snowflakeId('id')
      .primaryKey()
      .$defaultFn(() => generateSnowflakeId()),
    userId: snowflakeId('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: snowflakeId('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('comments_user_id_idx').on(table.userId),
    postIdIdx: index('comments_post_id_idx').on(table.postId),
    createdAtIdx: index('comments_created_at_idx').on(table.createdAt),
  })
);


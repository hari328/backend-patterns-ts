import { pgTable, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { snowflakeId } from '../utils/snowflake-column';
import { generateSnowflakeId } from '../utils/snowflake';
import { users } from './users';
import { posts } from './posts';

export const likes = pgTable(
  'likes',
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('likes_user_id_idx').on(table.userId),
    postIdIdx: index('likes_post_id_idx').on(table.postId),
    uniqueUserPost: unique('unique_user_post_like').on(table.userId, table.postId),
  })
);


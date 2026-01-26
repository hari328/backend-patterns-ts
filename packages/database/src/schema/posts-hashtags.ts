import { pgTable, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { snowflakeId } from '../utils/snowflake-column';
import { generateSnowflakeId } from '../utils/snowflake';
import { posts } from './posts';
import { hashtags } from './hashtags';

export const postsHashtags = pgTable(
  'posts_hashtags',
  {
    id: snowflakeId('id')
      .primaryKey()
      .$defaultFn(() => generateSnowflakeId()),
    postId: snowflakeId('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    hashtagId: snowflakeId('hashtag_id')
      .notNull()
      .references(() => hashtags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index('posts_hashtags_post_id_idx').on(table.postId),
    hashtagIdIdx: index('posts_hashtags_hashtag_id_idx').on(table.hashtagId),
    uniquePostHashtag: unique('unique_post_hashtag').on(table.postId, table.hashtagId),
  })
);


import { pgTable, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { snowflakeId } from '../utils/snowflake-column';
import { generateSnowflakeId } from '../utils/snowflake';

export const hashtags = pgTable(
  'hashtags',
  {
    id: snowflakeId('id')
      .primaryKey()
      .$defaultFn(() => generateSnowflakeId()),
    name: varchar('name', { length: 100 }).notNull().unique(),
    usageCount: integer('usage_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('hashtags_name_idx').on(table.name),
    usageCountIdx: index('hashtags_usage_count_idx').on(table.usageCount),
  })
);


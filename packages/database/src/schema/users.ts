import { pgTable, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { snowflakeId } from '../utils/snowflake-column';
import { generateSnowflakeId } from '../utils/snowflake';

export const users = pgTable('users', {
  id: snowflakeId('id')
    .primaryKey()
    .$defaultFn(() => generateSnowflakeId()),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  bio: text('bio'),
  profilePictureUrl: varchar('profile_picture_url', { length: 500 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


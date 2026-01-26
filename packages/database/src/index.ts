// Export database client and schema
export { db, schema, type Database } from './client';

// Export individual tables for convenience
export { users } from './schema/users';
export { posts } from './schema/posts';
export { hashtags } from './schema/hashtags';
export { postsHashtags } from './schema/posts-hashtags';
export { comments } from './schema/comments';
export { likes } from './schema/likes';

// Export Snowflake ID utilities
export {
  generateSnowflakeId,
  decodeSnowflakeId,
  getWorkerIdFromSnowflake,
  getSequenceFromSnowflake,
} from './utils/snowflake';

// Export test utilities
export { setupTestDb } from './test-utils/setup-test-db';


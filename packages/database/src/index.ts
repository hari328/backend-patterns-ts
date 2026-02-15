export { db, schema, type Database } from './client';

export { users } from './schema/users';
export { posts } from './schema/posts';
export { hashtags } from './schema/hashtags';
export { postsHashtags } from './schema/posts-hashtags';
export { comments } from './schema/comments';
export { likes } from './schema/likes';

export {
  generateSnowflakeId,
  decodeSnowflakeId,
  getWorkerIdFromSnowflake,
  getSequenceFromSnowflake,
} from './utils/snowflake';


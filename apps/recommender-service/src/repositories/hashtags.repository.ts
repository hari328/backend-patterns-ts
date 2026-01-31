import { db as defaultDb, posts, hashtags, postsHashtags, generateSnowflakeId } from '@repo/database';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';

export interface HashtagData {
  name: string;
  postId: string;
}

export class HashtagsRepository {
  private db: typeof defaultDb;

  constructor(db: typeof defaultDb = defaultDb) {
    this.db = db;
  }

  async getPostById(postId: string): Promise<{ id: string; caption: string } | null> {
    const post = await this.db.query.posts.findFirst({
      where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
      columns: {
        id: true,
        caption: true,
      },
    });

    return post || null;
  }

  async findHashtagByName(name: string): Promise<{ id: string; name: string; usageCount: number } | null> {
    const hashtag = await this.db.query.hashtags.findFirst({
      where: eq(hashtags.name, name),
      columns: {
        id: true,
        name: true,
        usageCount: true,
      },
    });

    return hashtag || null;
  }

  async batchUpsertHashtags(hashtagCounts: Map<string, number>): Promise<Map<string, string>> {
    if (hashtagCounts.size === 0) {
      return new Map();
    }

    const hashtagMap = new Map<string, string>();

    await this.db.transaction(async (tx) => {
      for (const [name, count] of hashtagCounts.entries()) {
        const [upsertedHashtag] = await tx
          .insert(hashtags)
          .values({
            id: generateSnowflakeId(),
            name,
            usageCount: count,
          })
          .onConflictDoUpdate({
            target: hashtags.name,
            set: {
              usageCount: sql`${hashtags.usageCount} + ${count}`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: hashtags.id, name: hashtags.name });

        if (upsertedHashtag) {
          hashtagMap.set(upsertedHashtag.name, upsertedHashtag.id);
        }
      }
    });

    return hashtagMap;
  }

  async createPostHashtag(postId: string, hashtagId: string): Promise<void> {
    await this.db
      .insert(postsHashtags)
      .values({
        id: generateSnowflakeId(),
        postId,
        hashtagId,
      })
      .onConflictDoNothing();
  }

  async batchCreatePostHashtags(postHashtagPairs: Array<{ postId: string; hashtagId: string }>): Promise<void> {
    if (postHashtagPairs.length === 0) {
      return;
    }

    const values = postHashtagPairs.map((pair) => ({
      id: generateSnowflakeId(),
      postId: pair.postId,
      hashtagId: pair.hashtagId,
    }));

    await this.db
      .insert(postsHashtags)
      .values(values)
      .onConflictDoNothing();
  }

  async findTopHashtags(limit: number): Promise<Array<{ id: string; name: string; usageCount: number }>> {
    const results = await this.db
      .select({
        id: hashtags.id,
        name: hashtags.name,
        usageCount: hashtags.usageCount,
      })
      .from(hashtags)
      .orderBy(desc(hashtags.usageCount))
      .limit(limit);

    return results;
  }
}


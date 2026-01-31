import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { hashtags, postsHashtags } from '@repo/database/schema';
import {
  connectToDockerDB,
  cleanTestData,
  closeDB,
  getTestUser,
} from './test-utils/db-helpers';
import { waitForCondition } from './test-utils/wait-helpers';

describe('Posts → Hashtags Integration Flow', () => {
  let db: any;
  let testUser: { id: string; username: string };

  beforeAll(async () => {
    db = await connectToDockerDB();
    testUser = await getTestUser(db);
    console.log(`Using test user: ${testUser.username} (${testUser.id})`);
  });

  beforeEach(async () => {
    await cleanTestData(db);
  });

  afterAll(async () => {
    await closeDB();
  });

  it('should create posts and extract hashtags to database', async () => {
    const post1Response = await request('http://localhost:6001')
      .post('/api/posts')
      .send({
        userId: testUser.id,
        caption: 'Learning #nodejs and #typescript today!',
      })
      .expect(201);

    expect(post1Response.body.id).toBeDefined();
    const post1Id = post1Response.body.id;

    const post2Response = await request('http://localhost:6001')
      .post('/api/posts')
      .send({
        userId: testUser.id,
        caption: 'Building microservices with #nodejs and #docker',
      })
      .expect(201);

    expect(post2Response.body.id).toBeDefined();
    const post2Id = post2Response.body.id;

    console.log('Waiting for hashtags to be processed...');
    
    await waitForCondition(async () => {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hashtags);
      return result[0].count >= 3;
    }, { timeout: 15000, interval: 500 });

    const allHashtags = await db.select().from(hashtags);

    console.log(`📊 Hashtags - Expected: 3, Got: ${allHashtags.length}`);
    console.log(`   Hashtag names: ${allHashtags.map(h => h.name).sort().join(', ')}`);

    expect(allHashtags).toHaveLength(3);

    const hashtagNames = allHashtags.map(h => h.name).sort();
    expect(hashtagNames).toEqual(['docker', 'nodejs', 'typescript']);

    const allPostHashtags = await db.select().from(postsHashtags);

    console.log(`📊 Posts-Hashtags - Expected: 4, Got: ${allPostHashtags.length}`);
    console.log(`   Post 1 (${post1Id}): ${allPostHashtags.filter(ph => ph.postId === post1Id).length} hashtags`);
    console.log(`   Post 2 (${post2Id}): ${allPostHashtags.filter(ph => ph.postId === post2Id).length} hashtags`);

    expect(allPostHashtags).toHaveLength(4);

    const post1Hashtags = allPostHashtags.filter(
      ph => ph.postId === post1Id
    );
    expect(post1Hashtags).toHaveLength(2);

    const post2Hashtags = allPostHashtags.filter(
      ph => ph.postId === post2Id
    );
    expect(post2Hashtags).toHaveLength(2);

    console.log('✅ Integration test passed!');
  });
});


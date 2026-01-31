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
    }, { timeout: 300000, interval: 1000 });

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

    // Test the GET /api/hashtags/top endpoint
    console.log('Testing GET /api/hashtags/top endpoint...');

    // Test 1: Get top 5 hashtags (default)
    const topHashtagsResponse = await request('http://localhost:6000')
      .get('/api/hashtags/top')
      .expect(200);

    console.log(`📊 API Response - Count: ${topHashtagsResponse.body.count}`);
    console.log(`   Hashtags: ${topHashtagsResponse.body.hashtags.map((h: any) => `${h.name}(${h.usageCount})`).join(', ')}`);

    expect(topHashtagsResponse.body).toHaveProperty('hashtags');
    expect(topHashtagsResponse.body).toHaveProperty('count');
    expect(topHashtagsResponse.body.hashtags).toHaveLength(3);
    expect(topHashtagsResponse.body.count).toBe(3);

    // Verify hashtags are ordered by usageCount descending
    const apiHashtags = topHashtagsResponse.body.hashtags;
    expect(apiHashtags[0].name).toBe('nodejs');
    expect(apiHashtags[0].usageCount).toBe(2);

    // The other two hashtags (docker and typescript) both have usageCount 1
    const remainingHashtags = apiHashtags.slice(1);
    expect(remainingHashtags).toHaveLength(2);
    remainingHashtags.forEach((h: any) => {
      expect(h.usageCount).toBe(1);
      expect(['docker', 'typescript']).toContain(h.name);
    });

    // Verify all hashtags have required fields
    apiHashtags.forEach((h: any) => {
      expect(h).toHaveProperty('id');
      expect(h).toHaveProperty('name');
      expect(h).toHaveProperty('usageCount');
      expect(typeof h.id).toBe('string');
      expect(typeof h.name).toBe('string');
      expect(typeof h.usageCount).toBe('number');
    });

    // Test 2: Get top 2 hashtags (custom limit)
    const top2Response = await request('http://localhost:6000')
      .get('/api/hashtags/top?limit=2')
      .expect(200);

    console.log(`📊 API Response (limit=2) - Count: ${top2Response.body.count}`);
    expect(top2Response.body.hashtags).toHaveLength(2);
    expect(top2Response.body.count).toBe(2);
    expect(top2Response.body.hashtags[0].name).toBe('nodejs');

    // Test 3: Get top 1 hashtag
    const top1Response = await request('http://localhost:6000')
      .get('/api/hashtags/top?limit=1')
      .expect(200);

    expect(top1Response.body.hashtags).toHaveLength(1);
    expect(top1Response.body.count).toBe(1);
    expect(top1Response.body.hashtags[0].name).toBe('nodejs');
    expect(top1Response.body.hashtags[0].usageCount).toBe(2);

    // Test 4: Verify database state matches API response
    const dbHashtagsOrdered = allHashtags.sort((a, b) => b.usageCount - a.usageCount);
    expect(apiHashtags.length).toBe(dbHashtagsOrdered.length);

    // Verify each API hashtag exists in the database with matching data
    apiHashtags.forEach((apiHashtag: any) => {
      const dbHashtag = allHashtags.find(h => h.id === apiHashtag.id);
      expect(dbHashtag).toBeDefined();
      expect(apiHashtag.name).toBe(dbHashtag!.name);
      expect(apiHashtag.usageCount).toBe(dbHashtag!.usageCount);
    });

    console.log('✅ Integration test passed (including API endpoint tests)!');
  });
});


import { HashtagsRepository, HashtagData } from '../repositories/hashtags.repository';

export class HashtagService {
  constructor(private hashtagRepository: HashtagsRepository) {}

  extractHashtags(caption: string): string[] {
    const regex = /#(\w+)/g;
    const matches = caption.matchAll(regex);
    const hashtags = Array.from(matches, (match) => match[1]?.toLowerCase() || '').filter(Boolean);

    return Array.from(new Set(hashtags));
  }

  async processPostHashtags(postId: string): Promise<void> {
    const post = await this.hashtagRepository.getPostById(postId);
    
    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    const hashtagNames = this.extractHashtags(post.caption);

    if (hashtagNames.length === 0) {
      console.log(`[HashtagService] No hashtags found in post ${postId}`);
      return;
    }

    const hashtagCounts = new Map<string, number>();
    for (const name of hashtagNames) {
      hashtagCounts.set(name, (hashtagCounts.get(name) || 0) + 1);
    }

    const hashtagMap = await this.hashtagRepository.batchUpsertHashtags(hashtagCounts);

    const postHashtagPairs = hashtagNames
      .map((name) => {
        const hashtagId = hashtagMap.get(name);
        if (!hashtagId) {
          console.error(`[HashtagService] Failed to get hashtag ID for: ${name}`);
          return null;
        }
        return { postId, hashtagId };
      })
      .filter((pair): pair is { postId: string; hashtagId: string } => pair !== null);

    await this.hashtagRepository.batchCreatePostHashtags(postHashtagPairs);

    console.log(`[HashtagService] Processed ${hashtagNames.length} hashtags for post ${postId}`);
  }

  async batchProcessHashtags(hashtagDataMap: Map<string, HashtagData[]>): Promise<void> {
    const hashtagCounts = new Map<string, number>();
    const postHashtagMapping: Array<{ postId: string; hashtagName: string }> = [];

    for (const [hashtagName, dataArray] of hashtagDataMap.entries()) {
      hashtagCounts.set(hashtagName, dataArray.length);

      for (const data of dataArray) {
        postHashtagMapping.push({
          postId: data.postId,
          hashtagName,
        });
      }
    }

    const hashtagMap = await this.hashtagRepository.batchUpsertHashtags(hashtagCounts);

    const postHashtagPairs = postHashtagMapping
      .map((mapping) => {
        const hashtagId = hashtagMap.get(mapping.hashtagName);
        if (!hashtagId) {
          console.error(`[HashtagService] Failed to get hashtag ID for: ${mapping.hashtagName}`);
          return null;
        }
        return { postId: mapping.postId, hashtagId };
      })
      .filter((pair): pair is { postId: string; hashtagId: string } => pair !== null);

    await this.hashtagRepository.batchCreatePostHashtags(postHashtagPairs);

    console.log(`[HashtagService] Batch processed ${hashtagCounts.size} unique hashtags from ${postHashtagMapping.length} post-hashtag relationships`);
  }
}


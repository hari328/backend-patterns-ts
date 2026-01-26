import { db as defaultDb, users, posts } from '@repo/database';
import { eq, and, isNull } from 'drizzle-orm';
import { CreatePostData, PostResponse, User } from '../types/posts.types';

export class PostsRepository {
  private db: typeof defaultDb;

  constructor(db: typeof defaultDb = defaultDb) {
    this.db = db;
  }

  async findUserById(userId: string): Promise<User | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        isVerified: true,
      },
    });

    return user || null;
  }

  async createPost(data: CreatePostData): Promise<PostResponse> {
    const [post] = await this.db
      .insert(posts)
      .values({
        id: data.id,
        userId: data.userId,
        caption: data.caption,
      })
      .returning();

    if (!post) {
      throw new Error('Failed to create post');
    }

    return post;
  }

  async findPostById(postId: string): Promise<PostResponse | null> {
    const post = await this.db.query.posts.findFirst({
      where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
    });

    return post || null;
  }

  async findPostsByUserId(userId: string): Promise<PostResponse[]> {
    const userPosts = await this.db.query.posts.findMany({
      where: and(eq(posts.userId, userId), isNull(posts.deletedAt)),
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    });

    return userPosts;
  }

  async findAllUsers(): Promise<User[]> {
    const allUsers = await this.db.query.users.findMany({
      columns: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        isVerified: true,
      },
    });

    return allUsers;
  }
}

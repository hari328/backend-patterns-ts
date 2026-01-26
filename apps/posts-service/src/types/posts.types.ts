/**
 * Request body for creating a post
 */
export interface CreatePostRequest {
  userId: string;
  caption: string;
}

/**
 * Response for a post
 */
export interface PostResponse {
  id: string;
  userId: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Repository method input for creating a post
 */
export interface CreatePostData {
  id: string;
  userId: string;
  caption: string;
}

/**
 * User entity (simplified)
 */
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  isVerified: boolean;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}


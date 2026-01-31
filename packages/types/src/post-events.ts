export interface PostCreatedEvent {
  eventType: 'POST_CREATED';
  postId: string;
  userId: string;
  timestamp: string;
}


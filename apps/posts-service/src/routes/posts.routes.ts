import { Router } from 'express';
import { PostsController } from '../controllers/posts.controller';
import { PostsService } from '../services/posts.service';
import { PostsRepository } from '../repositories/posts.repository';
import { PostsSQSPublisher } from '../services/sqs-publisher';
import { env } from '../config/env';

const router = Router();

const repository = new PostsRepository();
const sqsPublisher = new PostsSQSPublisher(env.SQS_POSTS_STREAM_QUEUE_URL);
const service = new PostsService(repository, sqsPublisher);
const controller = new PostsController(service);

router.get('/users', controller.getUsers.bind(controller));
router.post('/posts', controller.createPost.bind(controller));
router.get('/posts/:postId', controller.getPostById.bind(controller));
router.get('/users/:userId/posts', controller.getPostsByUserId.bind(controller));

export default router;


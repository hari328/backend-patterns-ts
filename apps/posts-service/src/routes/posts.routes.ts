import { Router } from 'express';
import { PostsController } from '../controllers/posts.controller';
import { PostsService } from '../services/posts.service';
import { PostsRepository } from '../repositories/posts.repository';

const router = Router();

const repository = new PostsRepository();
const service = new PostsService(repository);
const controller = new PostsController(service);

router.get('/users', controller.getUsers.bind(controller));
router.post('/posts', controller.createPost.bind(controller));
router.get('/posts/:postId', controller.getPostById.bind(controller));
router.get('/users/:userId/posts', controller.getPostsByUserId.bind(controller));

export default router;


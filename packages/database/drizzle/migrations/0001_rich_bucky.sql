ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "hashtags" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "posts_hashtags" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "posts_hashtags" ALTER COLUMN "post_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "posts_hashtags" ALTER COLUMN "hashtag_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "post_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "likes" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "likes" ALTER COLUMN "user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "likes" ALTER COLUMN "post_id" SET DATA TYPE bigint;
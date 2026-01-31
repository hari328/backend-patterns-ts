list of users

curl http://localhost:6001/api/users | jq


create a post

```
curl -X POST http://localhost:6001/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "275856737938968593",
    "caption": "Testing hashtags #javascript #nodejs #typescript #react"
  }'
 ``` 

 check of hashtags are created

 ```
 # Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d social_media_db

# Query hashtags
SELECT * FROM hashtags ORDER BY usage_count DESC;

# Query post-hashtag relationships
SELECT * FROM posts_hashtags;
```

---

how to run integration tests

```

docker-compose up -d

docker-compose ps

npm run test:integration --workspace=integration-tests
``` 
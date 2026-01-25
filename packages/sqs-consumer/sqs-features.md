# SQS Features

I have see SQS working with following features I want to understand which ones make sense and which
ones are really a over kill.

## Basic Features

1. sqs having a consumer and message handler.
    * consumer instance remains the same once in code and we attach multiple message handlers to one consumer.
    * consumer always get n messages and process them.

2. sqs consumer should always batch write to database as from above we always get array of messages.

3. a service can have multiple sqs consumer running at same time, hence the there will be multiple configs can use sqs_name='posts-stream'.

4. if the message is being retried for the last time we should, inform the handler.

5. there should be 2 sections of messages one for the actual message and other for the metadata like retry count, last retry time, etc.

6. there should be different types of message response from handler like
    * success - delete the message from queue
    * retry - retry the message after some time
    * fail - move the message to dead letter queue / delete the message from queue


## Advanced Features driven by config

1. consumer can process the messages in parallel or serially based on config.

2. sqs consumer uses two buffer to periodically write to db based on config.

3. sqs with different types of retry mechanism based on config.
    * I can have sqs logic with exponential back off, fixed time back off, etc.
    * this can be implemented on top of redis as utility

4. sqs should have idempotency check based on config.
    * this can be implemented on top of redis for now

5. sqs should have dead letter queue
    * this can be implemented on top of sqs as utility

## decisions

1. no poison pill sqs need not have poison pill pattern as we will control it with config if needed not a big thing if you ask me

2. single queue can use for multiple messages based on message type
    * how much does a sqs queue cost in aws ?
    * lets assume we process 1 million message in a day and each message is of size 500 bytes

    I did some analysis on aws cost usage of queue, there is no fixed cost for using sqs queue but we have to pay for
    1. read message
    2. write message
    3. delete message
    4. size of message

    so lets say I have 1 million messages of size 500 bytes each and I process them in 250 batch size which means I read 250 messages at a time and write 250 messages at a time and delete 250 messages at a time.
    * read 1 million messages = 1 million / 250 = 4000 times
    * write 1 million messages = 1 million / 250 = 4000 times
    * delete 1 million messages = 1 million / 250 = 4000 times

    so total api calls = 12000 times

    hence batching is critical while using sqs.
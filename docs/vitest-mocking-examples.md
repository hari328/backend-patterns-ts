# Vitest Mocking Examples

## Understanding Mocking

**Mocking** = Creating fake versions of functions/objects to control their behavior in tests.

---

## Basic Vitest Mocking

### 1. Mock a Simple Function

```typescript
import { vi } from 'vitest';

// Create a mock function
const mockFn = vi.fn();

// Set return value
mockFn.mockReturnValue('hello');

// Call it
const result = mockFn();
console.log(result); // 'hello'

// Check if it was called
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(1);
```

### 2. Mock with Different Return Values

```typescript
const mockFn = vi.fn();

// First call returns 'first'
mockFn.mockReturnValueOnce('first');

// Second call returns 'second'
mockFn.mockReturnValueOnce('second');

// All subsequent calls return 'default'
mockFn.mockReturnValue('default');

console.log(mockFn()); // 'first'
console.log(mockFn()); // 'second'
console.log(mockFn()); // 'default'
console.log(mockFn()); // 'default'
```

### 3. Mock Async Functions

```typescript
const mockAsyncFn = vi.fn();

// Resolve with a value
mockAsyncFn.mockResolvedValue({ data: 'success' });

const result = await mockAsyncFn();
console.log(result); // { data: 'success' }

// Reject with an error
mockAsyncFn.mockRejectedValue(new Error('Failed'));

try {
  await mockAsyncFn();
} catch (error) {
  console.log(error.message); // 'Failed'
}
```

---

## Mocking AWS SDK SQSClient

### The Challenge

AWS SDK v3 uses this pattern:
```typescript
const client = new SQSClient({ region: 'us-east-1' });
const response = await client.send(new ReceiveMessageCommand({ ... }));
```

We need to mock the `send` method.

### Solution: Spy on Prototype

```typescript
import { vi } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';

// Create a mock function
const mockSend = vi.fn();

// Replace SQSClient.prototype.send with our mock
vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);

// Now ANY instance of SQSClient will use our mock
const client = new SQSClient({ region: 'us-east-1' });
await client.send(command); // Uses mockSend!
```

### Mock Different Responses

```typescript
const mockSend = vi.fn();
vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);

// First call: ReceiveMessage returns messages
mockSend.mockResolvedValueOnce({
  Messages: [
    {
      MessageId: '123',
      ReceiptHandle: 'receipt-123',
      Body: JSON.stringify({ hello: 'world' })
    }
  ]
});

// Second call: DeleteMessageBatch succeeds
mockSend.mockResolvedValueOnce({
  Successful: [{ Id: '0' }],
  Failed: []
});

// Third call: ReceiveMessage returns empty
mockSend.mockResolvedValueOnce({
  Messages: []
});
```

---

## Complete Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';

describe('SQS Mocking Example', () => {
  let mockSend: any;

  beforeEach(() => {
    // Clear previous mocks
    vi.clearAllMocks();

    // Create fresh mock
    mockSend = vi.fn();
    vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);
  });

  it('should mock SQS receive message', async () => {
    // Arrange: Set up mock response
    mockSend.mockResolvedValue({
      Messages: [
        {
          MessageId: 'msg-1',
          ReceiptHandle: 'receipt-1',
          Body: JSON.stringify({ postId: '123' })
        }
      ]
    });

    // Act: Use the client
    const client = new SQSClient({ region: 'us-east-1' });
    const response = await client.send({ /* command */ } as any);

    // Assert: Check the response
    expect(response.Messages).toHaveLength(1);
    expect(response.Messages[0].MessageId).toBe('msg-1');

    // Assert: Check mock was called
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
```

---

## Key Vitest Assertions

```typescript
// Function was called
expect(mockFn).toHaveBeenCalled();

// Function was called N times
expect(mockFn).toHaveBeenCalledTimes(3);

// Function was called with specific arguments
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');

// Function was called with object containing properties
expect(mockFn).toHaveBeenCalledWith(
  expect.objectContaining({ id: '123' })
);

// Value equality
expect(result).toBe('hello');
expect(result).toEqual({ name: 'John' });

// Array/Object checks
expect(array).toHaveLength(5);
expect(obj).toHaveProperty('name');
```

---

## Cleanup

```typescript
import { afterEach } from 'vitest';

afterEach(() => {
  // Restore all mocks to original implementations
  vi.restoreAllMocks();
  
  // Or just clear call history
  vi.clearAllMocks();
});
```

---

## Summary

1. **Create mock**: `const mockFn = vi.fn()`
2. **Set return value**: `mockFn.mockReturnValue(value)`
3. **Set async return**: `mockFn.mockResolvedValue(value)`
4. **Spy on method**: `vi.spyOn(Class.prototype, 'method')`
5. **Assert calls**: `expect(mockFn).toHaveBeenCalled()`
6. **Cleanup**: `vi.restoreAllMocks()`


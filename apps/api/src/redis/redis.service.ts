import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
    this.client = new Redis(redisUrl, { lazyConnect: true });
  }

  async cacheAttemptState(attemptId: string, statePayload: unknown, ttlSeconds = 10800) {
    await this.client.set(`cbt:attempt:${attemptId}`, JSON.stringify(statePayload), 'EX', ttlSeconds);
  }

  async getAttemptState(attemptId: string) {
    const raw = await this.client.get(`cbt:attempt:${attemptId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async recordPaperScoreAndGetPercentile(paperId: string, attemptId: string, score: number): Promise<number> {
    const key = `leaderboard:paper:${paperId}`;
    await this.client.zadd(key, score, attemptId);
    const total = await this.client.zcard(key);
    const rank = await this.client.zrank(key, attemptId);
    if (!total || rank === null) return 85.0;
    return Number((((rank + 1) / total) * 100).toFixed(1));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod/v4';
import { validateBody } from '../middleware/validate';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive().optional(),
});

describe('Validation Middleware', () => {
  const app = express();
  app.use(express.json());

  app.post('/test', validateBody(testSchema), (req, res) => {
    res.json({ received: req.body });
  });

  it('should accept valid body', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'John', age: 30 });
    expect(res.status).toBe(200);
    expect(res.body.received.name).toBe('John');
  });

  it('should accept body with only required fields', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Jane' });
    expect(res.status).toBe(200);
  });

  it('should reject missing required field', async () => {
    const res = await request(app)
      .post('/test')
      .send({ age: 25 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it('should reject empty required string', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('should reject wrong type', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'John', age: 'not a number' });
    expect(res.status).toBe(400);
    expect(res.body.issues.some((i: { path: string }) => i.path === 'age')).toBe(true);
  });

  it('should strip unknown fields', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'John', extra: 'field' });
    expect(res.status).toBe(200);
    // Zod strips unknown fields by default
    expect(res.body.received.extra).toBeUndefined();
  });
});

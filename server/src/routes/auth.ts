import { Router, Request, Response } from 'express';
import { z } from 'zod/v4';
import { validateBody } from '../middleware/validate';
import type { IAuthProvider } from '../auth/types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional().default(''),
});

export function createAuthRouter(authProvider: IAuthProvider): Router {
  const router = Router();

  // POST /api/auth/login — staff login
  router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const result = await authProvider.createStaffToken(email, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json({ token: result.token, user: result.user });
  });

  // POST /api/auth/client/login — client login
  router.post('/client/login', validateBody(loginSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const result = await authProvider.createClientToken(email, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json({ token: result.token, client: result.client });
  });

  // GET /api/auth/me — get current user (requires auth middleware)
  router.get('/me', (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json(req.user);
  });

  return router;
}

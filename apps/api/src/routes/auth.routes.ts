import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { connectionOptionsSchema } from '@dbi/shared';
import { AuthService } from '../services/auth.service';
import { registry } from '../db/registry';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';

const router = Router();
const auth = new AuthService();

router.get('/session', (req, res) => {
  const id = req.session?.connectionId;
  const meta = id ? registry.meta(id) : null;
  res.json({
    authenticated: Boolean(req.session?.authenticated && meta),
    connection: meta ?? undefined,
  });
});

router.post(
  '/login',
  validate(connectionOptionsSchema),
  asyncHandler(async (req, res) => {
    const connectionId = randomUUID();
    await auth.login(connectionId, req.body);
    req.session.authenticated = true;
    req.session.connectionId = connectionId;
    req.session.issuedAt = Date.now();
    res.json({ authenticated: true, connection: registry.meta(connectionId) });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const id = req.session?.connectionId;
    if (id) await auth.logout(id);
    req.session.destroy(() => {
      res.clearCookie('dbi.sid');
      res.json({ authenticated: false });
    });
  }),
);

export { router as authRoutes };

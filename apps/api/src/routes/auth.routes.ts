import { Router } from 'express';
import { loginRequestSchema } from '@dbi/shared';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';

const router = Router();
const auth = new AuthService();

router.get('/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session?.authenticated) });
});

router.post(
  '/login',
  validate(loginRequestSchema),
  asyncHandler(async (req, res) => {
    await auth.login(req.body.password);
    req.session.authenticated = true;
    req.session.issuedAt = Date.now();
    res.json({ authenticated: true });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await auth.logout();
    req.session.destroy(() => {
      res.clearCookie('dbi.sid');
      res.json({ authenticated: false });
    });
  }),
);

export { router as authRoutes };

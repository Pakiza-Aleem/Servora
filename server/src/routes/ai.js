import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth, allow } from '../middleware/auth.js';
import { aiAssistantController } from '../controllers/aiAssistantController.js';

const router = Router();
const assistantLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI questions. Please try again later.' },
});
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

router.post('/assistant', auth, allow('owner', 'manager'), assistantLimit, wrap(aiAssistantController));

export default router;

import { z } from 'zod';
import { answerBusinessQuestion } from '../services/aiAssistantService.js';

const questionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
});

export async function aiAssistantController(req, res) {
  const { question } = questionSchema.parse(req.body);
  const answer = await answerBusinessQuestion(req.user.restaurant, question);
  res.json({ answer });
}

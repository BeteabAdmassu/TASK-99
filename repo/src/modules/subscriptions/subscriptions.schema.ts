import { z } from 'zod';

export const updateSubscriptionSchema = z.object({
  category: z.string().min(1).max(100),
  isSubscribed: z.boolean(),
});

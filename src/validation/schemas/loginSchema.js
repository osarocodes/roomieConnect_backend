import { z } from 'zod';

export const loginSchema = z.object({
    identity: z.object({
        email: z.email(),
    }),
    auth: z.object({
        password: z.string().min(8)
    })
});


const configuredOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:4173',
    'https://roomie-connect-frontend-one.vercel.app',
    process.env.CLIENT_URL,
].filter(Boolean));

export const isAllowedOrigin = (origin) => {
    if (!origin || configuredOrigins.has(origin)) return true;
    if (process.env.NODE_ENV === 'production') return false;

    try {
        const url = new URL(origin);
        return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
        return false;
    }
};
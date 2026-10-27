import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In `npm run dev`, serve the /api/*.js functions the same way Vercel does,
 * so the whole app runs locally with one command.
 */
const localApi = () => ({
  name: 'local-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const match = req.url && req.url.match(/^\/api\/([a-z-]+)(?:\?.*)?$/);
      if (!match) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
        await mod.default(req, res);
      } catch (err) {
        if (err?.code === 'ERR_MODULE_NOT_FOUND' || /Failed to load url/.test(err?.message)) return next();
        console.error(err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Local API error' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  // Make .env values available to the API functions in dev (never to the browser)
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), localApi()] };
});

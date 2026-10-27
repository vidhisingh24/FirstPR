/** GET /api/health → which keys are set and which NVIDIA models this Token Factory key can use. */
import { route, send } from './_lib/http.js';
import { MODELS, listNvidiaModels } from './_lib/nebius.js';

export default route(['GET'], async (req, res) => {
  const out = {
    ok: true,
    keys: { nebius: !!process.env.NEBIUS_API_KEY, tavily: !!process.env.TAVILY_API_KEY, github: !!process.env.GITHUB_TOKEN },
    models: MODELS,
  };
  if (out.keys.nebius) {
    try {
      out.availableNvidiaModels = await listNvidiaModels();
      out.modelsFound = { fast: out.availableNvidiaModels.includes(MODELS.fast), smart: out.availableNvidiaModels.includes(MODELS.smart) };
    } catch (err) {
      out.ok = false;
      out.error = err.message;
    }
  }
  send(res, 200, out);
});

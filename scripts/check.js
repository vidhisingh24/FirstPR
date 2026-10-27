/**
 * Quick setup check: `npm run check`
 * Confirms your Nebius key works, lists the NVIDIA models you can use and runs a tiny Nemotron call.
 */
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { MODELS, chat, listNvidiaModels } = await import('../api/_lib/nebius.js');

if (!process.env.NEBIUS_API_KEY) {
  console.error('✗ NEBIUS_API_KEY is not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}

try {
  const models = await listNvidiaModels();
  console.log(`✓ Key works. NVIDIA models on your account:\n  ${models.join('\n  ') || '(none listed)'}`);
  for (const [role, id] of Object.entries(MODELS)) console.log(`${models.includes(id) ? '✓' : '✗'} ${role} model: ${id}`);
  const { text } = await chat({ model: MODELS.fast, messages: [{ role: 'user', content: 'Reply with exactly: FirstPR is ready.' }], max_tokens: 400 });
  console.log(`✓ Test call to ${MODELS.fast}: ${text.slice(0, 80)}`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
console.log(process.env.TAVILY_API_KEY ? '✓ TAVILY_API_KEY set' : '• TAVILY_API_KEY not set (docs search will be skipped)');
console.log(process.env.GITHUB_TOKEN ? '✓ GITHUB_TOKEN set' : '• GITHUB_TOKEN not set (GitHub allows 60 requests/hour without it)');

import http from 'node:http';
import { readFileSync } from 'node:fs';
import app, { devEnv } from '../api/index.js';

const port = app.get('port');

// Forge invokeRemote sends a large Forge Invocation Token header; Node's 16KB default answers 431.
const server = http.createServer({ maxHeaderSize: 1024 * 1024 }, app);
server.listen(port, async () => {
  console.log(
    'App server running at http://' +
      server.address().address +
      ':' +
      server.address().port,
  );
  if (!devEnv) {
    return;
  }
  try {
    // devDependency: load only in development.
    const { default: ngrok } = await import('@ngrok/ngrok');
    const { ngrok: cfg } = JSON.parse(readFileSync('credentials.json', 'utf8'));
    const listener = await ngrok.forward({ addr: Number(port), ...cfg });
    console.log({ url: listener.url() }, 'ngrok tunnel');
  } catch (err) {
    console.error({ err: err.message }, 'ngrok not started');
  }
});

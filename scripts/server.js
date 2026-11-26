#!/usr/bin/env node

import http from "node:http";
import app, {devEnv, addon} from '../api/index.js';

// Boot the HTTP server
const server = http.createServer(app);
server.listen(app.get("port"), () => {
  console.log("App server running at http://" + server.address().address + ":" + server.address().port);

  // Enables auto registration/de-registration of app into a host in dev mode
  if (devEnv) addon.register();
});

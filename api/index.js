// Entry point for the app
// Express is the underlying that atlassian-connect-express uses:
// https://expressjs.com
import express from "express";

// https://expressjs.com/en/guide/using-middleware.html
import bodyParser from "body-parser";
import compression from "compression";
import cookieParser from "cookie-parser";
import errorHandler from "errorhandler";
import morgan from "morgan";

// atlassian-connect-express also provides a middleware
import ace from "atlassian-connect-express";

// Use Handlebars as view engine:
// https://npmjs.org/package/express-hbs
// http://handlebarsjs.com
import hbs from "express-hbs";

// We also need a few stock Node modules
import path from "path";
import os from "os";
import helmet from "helmet";
import nocache from "nocache";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createRequire } from "node:module";

// Routes live here; this is the C in MVC
import routes from "../routes/index.js";
import { readFileSync } from "fs";

// Use Vercel Serverless Redis connection
import { ServerlessRedisAdapter } from "../serverless-redis.js";

ace.store.register("@upstash/redis", function (logger, opts) {
  if (arguments.length === 0) {
    return ServerlessRedisAdapter;
  }
  return new ServerlessRedisAdapter(logger, opts);
});

console.log('\n=== STARTUP CONFIGURATION ===');
console.log("CWD is ", process.cwd());
console.log("NODE_ENV is ", process.env.NODE_ENV);
console.log("PORT is ", process.env.PORT);
console.log("VERCEL_BRANCH_URL is ", process.env.VERCEL_BRANCH_URL);
console.log("KV_REST_API_URL is ", process.env.KV_REST_API_URL ? '[SET]' : '[NOT_SET]');
console.log("KV_REST_API_TOKEN is ", process.env.KV_REST_API_TOKEN ? '[SET]' : '[NOT_SET]');
console.log("config.json is at ", resolve("config.json"));
console.log(
  "config.json is at ",
  createRequire(import.meta.url).resolve("../config.json")
);
console.log(
  "config.json contents are ",
  readFileSync("config.json", { encoding: "utf8" })
);

console.log("atlassian-connect.json is at ", resolve("atlassian-connect.json"));
console.log(
  "atlassian-connect.json is at ",
  createRequire(import.meta.url).resolve("../atlassian-connect.json")
);
console.log(
  "atlassian-connect.json contents are ",
  readFileSync("atlassian-connect.json", { encoding: "utf8" })
);
console.log('============================\n');

// Bootstrap Express and atlassian-connect-express
const app = express();
export const addon = ace(app, {
  config: {
    descriptorTransformer(self, config) {
      console.log('\n=== DESCRIPTOR TRANSFORMER ===');
      console.log('Base URL in descriptor:', self.baseUrl);
      console.log('Local base URL from config:', config.localBaseUrl());
      console.log('Environment NODE_ENV:', process.env.NODE_ENV);
      console.log('Full descriptor:', JSON.stringify(self, null, 2));
      console.log('=============================\n');
      return self;
    },
  },
});

// See config.json
const port = addon.config.port();
app.set("port", port);

console.log('\n=== ADDON CONFIGURATION ===');
console.log("localBaseUrl is ", addon.config.localBaseUrl());
console.log("port is ", port);
console.log("environment is ", app.get("env"));
console.log("=========================\n");

// Log requests, using an appropriate formatter by env
export const devEnv = app.get("env") === "development";

// Enhanced logging for debugging
app.use((req, res, next) => {
  if (req.url.includes('/installed') || req.url.includes('/atlassian-connect.json') || req.url.includes('/health')) {
    console.log('\n=== REQUEST INTERCEPTED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('User-Agent:', req.get('User-Agent'));
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Authorization header present:', !!req.get('Authorization'));
    console.log('Host:', req.get('Host'));
    console.log('X-Forwarded-For:', req.get('X-Forwarded-For'));
    console.log('X-Forwarded-Proto:', req.get('X-Forwarded-Proto'));
    console.log('Remote address:', req.connection?.remoteAddress || req.socket?.remoteAddress);
    console.log('========================\n');

    // Log response
    const originalEnd = res.end;
    const originalSend = res.send;
    const originalJson = res.json;

    res.end = function(...args) {
      console.log('\n=== RESPONSE SENT ===');
      console.log('URL:', req.url);
      console.log('Status Code:', res.statusCode);
      console.log('Headers:', res.getHeaders());
      console.log('===================\n');
      originalEnd.apply(res, args);
    };

    res.send = function(...args) {
      console.log('\n=== RESPONSE SEND ===');
      console.log('URL:', req.url);
      console.log('Status Code:', res.statusCode);
      console.log('Response body:', args[0]);
      console.log('==================\n');
      originalSend.apply(res, args);
    };

    res.json = function(...args) {
      console.log('\n=== RESPONSE JSON ===');
      console.log('URL:', req.url);
      console.log('Status Code:', res.statusCode);
      console.log('JSON body:', JSON.stringify(args[0], null, 2));
      console.log('==================\n');
      originalJson.apply(res, args);
    };
  }
  next();
});

app.use(morgan(devEnv ? "dev" : "combined"));

// We don't want to log JWT tokens, for security reasons
morgan.token("url", redactJwtTokens);

// Configure Handlebars
// Testing of what runs in vercel
const viewsDir = path.join(process.cwd(), "views");
const handlebarsEngine = hbs.express4({ partialsDir: viewsDir });
app.engine("hbs", handlebarsEngine);
app.set("view engine", "hbs");
app.set("views", viewsDir);

// Atlassian security policy requirements
// http://go.atlassian.com/security-requirements-for-cloud-apps
// HSTS must be enabled with a minimum age of at least one year
app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: false,
  })
);
app.use(
  helmet.referrerPolicy({
    policy: ["origin"],
  })
);

// Include request parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Gzip responses when appropriate
app.use(compression());

// Include atlassian-connect-express middleware
app.use(addon.middleware());

// Error handling middleware specifically for addon issues
app.use((err, req, res, next) => {
  if (req.url.includes('/installed')) {
    console.log('\n=== INSTALLATION ERROR ===');
    console.error('Error during installation:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('========================\n');
    
    // Send proper error response
    return res.status(500).json({
      error: 'Installation failed',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
  next(err);
});

// Mount the static files directory
const staticDir = path.join(process.cwd(), "public");
app.use(express.static(staticDir));

// Atlassian security policy requirements
// http://go.atlassian.com/security-requirements-for-cloud-apps
app.use(nocache());

// Show nicer errors in dev mode
if (devEnv) app.use(errorHandler());

// Wire up routes
routes(app, addon);

export default app;

function redactJwtTokens(req) {
  const url = req.originalUrl || req.url || "";
  const params = new URLSearchParams(url);
  let redacted = url;
  params.forEach((value, key) => {
    if (key.toLowerCase() === "jwt") {
      redacted = redacted.replace(value, "redacted");
    }
  });
  return redacted;
}

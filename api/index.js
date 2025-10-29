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

console.log("CWD is ", process.cwd());
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

// Bootstrap Express and atlassian-connect-express
const app = express();
export const addon = ace(app, {
  config: {
    descriptorTransformer(self, config) {
      console.log("Transformed descriptor is ", self);
      return self;
    },
  },
});

// See config.json
const port = addon.config.port();
app.set("port", port);

console.log("localBaseUrl is ", addon.config.localBaseUrl());

// Log requests, using an appropriate formatter by env
export const devEnv = app.get("env") === "development";
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

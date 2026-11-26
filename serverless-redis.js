/**
 * Adapted from https://bitbucket.org/atlassian/atlassian-connect-express/src/664d8284b66420229728b5a0501d6145bc2bf279/lib/store/redis.js
 * to use `@upstash/redis` instead of `redis` for running on serverless
 * environments like Vercel.
 *
 * Used under the Apache License, Version 2.0
 */

import { Redis } from "@upstash/redis"

const redisKey = (key, clientKey) => {
  return clientKey ? `${clientKey}:${key}` : key;
};

/**
 * @implements {typeof import("atlassian-connect-express").AddOn["settings"]}
 */
export class ServerlessRedisAdapter {
  constructor(logger, opts) {
    this.client = new Redis({
      url: process.env["DB_URL"] || opts.url,
      token: process.env["DB_TOKEN"] || opts.token,
    });
  }

  async get(key, clientKey) {
    const val = await this.client.get(redisKey(key, clientKey));

    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }

  async saveInstallation(val, clientKey) {
    const clientSetting = await this.set("clientInfo", val, clientKey);

    const forgeInstallationId = clientSetting.installationId;
    if (forgeInstallationId) {
      await this.associateInstallations(forgeInstallationId, clientKey);
    }

    return clientSetting;
  }

  async set(key, val, clientKey) {
    let strVal = val;

    if (typeof val !== "string") {
      strVal = JSON.stringify(val);
    }

    await this.client.set(redisKey(key, clientKey), strVal);
    return this.get(key, clientKey);
  }

  async del(key, clientKey) {
    await this.client.del(redisKey(key, clientKey));
  }

  async getAllClientInfos() {
    const keys = await this.client.keys("*:clientInfo");

    return Promise.all(
      keys.map(key => {
        return this.get(key);
      })
    );
  }

  isMemoryStore() {
    return false;
  }

  async associateInstallations(forgeInstallationId, clientKey) {
    await this.client.set(installationKey(forgeInstallationId), clientKey);
  }

  async deleteAssociation(forgeInstallationId) {
    await this.client.del(installationKey(forgeInstallationId));
  }

  async getClientSettingsForForgeInstallation(forgeInstallationId) {
    const clientKey = await this.client.get(
      installationKey(forgeInstallationId)
    );
    if (!clientKey) {
      return null;
    }
    return this.get("clientInfo", clientKey);
  }
}


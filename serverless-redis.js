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

const installationKey = (forgeInstallationId) => {
  return `installation:${forgeInstallationId}`;
};

/**
 * @implements {typeof import("atlassian-connect-express").AddOn["settings"]}
 */
export class ServerlessRedisAdapter {
  constructor(logger, opts) {
    console.log('\n=== SERVERLESS REDIS ADAPTER INIT ===');
    console.log('Options received:', JSON.stringify(opts, null, 2));
    console.log('DB_URL env:', process.env["DB_URL"] ? '[SET]' : '[NOT_SET]');
    console.log('DB_TOKEN env:', process.env["DB_TOKEN"] ? '[SET]' : '[NOT_SET]');
    console.log('KV_REST_API_URL env:', process.env["KV_REST_API_URL"] ? '[SET]' : '[NOT_SET]');
    console.log('KV_REST_API_TOKEN env:', process.env["KV_REST_API_TOKEN"] ? '[SET]' : '[NOT_SET]');
    
    try {
      this.client = new Redis({
        url: process.env["DB_URL"] || process.env["KV_REST_API_URL"] || opts.url,
        token: process.env["DB_TOKEN"] || process.env["KV_REST_API_TOKEN"] || opts.token,
      });
      console.log('Redis client created successfully');
    } catch (error) {
      console.error('Error creating Redis client:', error);
      throw error;
    }
    console.log('====================================\n');
  }

  async get(key, clientKey) {
    console.log(`\n=== REDIS GET ===`);
    console.log('Key:', key);
    console.log('Client Key:', clientKey);
    console.log('Redis Key:', redisKey(key, clientKey));
    
    try {
      const val = await this.client.get(redisKey(key, clientKey));
      console.log('Raw value:', val);
      
      try {
        const parsed = JSON.parse(val);
        console.log('Parsed value:', parsed);
        console.log('================\n');
        return parsed;
      } catch (e) {
        console.log('Value is not JSON, returning as string');
        console.log('================\n');
        return val;
      }
    } catch (error) {
      console.error('Redis GET error:', error);
      console.log('================\n');
      throw error;
    }
  }

  async saveInstallation(val, clientKey) {
    console.log(`\n=== SAVE INSTALLATION ===`);
    console.log('Installation data:', JSON.stringify(val, null, 2));
    console.log('Client Key:', clientKey);
    
    try {
      const clientSetting = await this.set("clientInfo", val, clientKey);
      console.log('Client setting saved:', JSON.stringify(clientSetting, null, 2));

      const forgeInstallationId = clientSetting.installationId;
      if (forgeInstallationId) {
        console.log('Found forge installation ID:', forgeInstallationId);
        await this.associateInstallations(forgeInstallationId, clientKey);
        console.log('Installations associated');
      } else {
        console.log('No forge installation ID found');
      }

      console.log('Installation saved successfully');
      console.log('========================\n');
      return clientSetting;
    } catch (error) {
      console.error('Save installation error:', error);
      console.log('========================\n');
      throw error;
    }
  }

  async set(key, val, clientKey) {
    console.log(`\n=== REDIS SET ===`);
    console.log('Key:', key);
    console.log('Value:', val);
    console.log('Client Key:', clientKey);
    console.log('Redis Key:', redisKey(key, clientKey));
    
    let strVal = val;

    if (typeof val !== "string") {
      strVal = JSON.stringify(val);
      console.log('Stringified value:', strVal);
    }

    try {
      await this.client.set(redisKey(key, clientKey), strVal);
      console.log('Value set successfully');
      const result = await this.get(key, clientKey);
      console.log('Verification get result:', result);
      console.log('================\n');
      return result;
    } catch (error) {
      console.error('Redis SET error:', error);
      console.log('================\n');
      throw error;
    }
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


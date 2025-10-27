import {fetchToken, saveToken} from '../utils/index.js';
import {MermaidChart} from '../utils/MermaidChart.js';

const MC_BASE_URL = process.env.MC_BASE_URL || "http://localhost:5174";

export default function routes(app, addon) {

  // Comprehensive logging middleware for installation endpoint
  app.use('/installed', (req, res, next) => {
    console.log('\n=== INSTALLATION ENDPOINT HIT ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Base URL from addon config:', addon.config.localBaseUrl());
    console.log('Environment variables:');
    console.log('  - NODE_ENV:', process.env.NODE_ENV);
    console.log('  - MC_BASE_URL:', process.env.MC_BASE_URL);
    console.log('  - PORT:', process.env.PORT);
    console.log('Request origin/host:', req.get('host'));
    console.log('Request protocol:', req.protocol);
    console.log('Is secure:', req.secure);
    console.log('Original URL:', req.originalUrl);
    console.log('================================\n');
    next();
  });

  const mermaidAPI = new MermaidChart({
    baseURL: MC_BASE_URL,
    clientID: process.env.MC_CLIENT_ID || "839d35ba-cfee-4c98-8cee-88f2d2caa0c4",
    redirectURI: `${addon.config.localBaseUrl()}/callback`,
    addon,
  })

  // Custom installation handler with detailed logging
  app.post('/installed', (req, res) => {
    console.log('\n=== CUSTOM INSTALLATION HANDLER ===');
    try {
      console.log('Installation payload received:', JSON.stringify(req.body, null, 2));
      console.log('Client key:', req.body.clientKey);
      console.log('Public key:', req.body.publicKey);
      console.log('Shared secret:', req.body.sharedSecret ? '[REDACTED - LENGTH: ' + req.body.sharedSecret.length + ']' : 'NOT_PROVIDED');
      console.log('Server version:', req.body.serverVersion);
      console.log('Plugin version:', req.body.pluginsVersion);
      console.log('Base URL:', req.body.baseUrl);
      console.log('Product type:', req.body.productType);
      console.log('Description:', req.body.description);
      console.log('Event type:', req.body.eventType);
      
      // Log addon store information
      console.log('Addon object:', !!addon);
      console.log('Addon store:', !!addon.store);
      console.log('Addon store type:', addon.store ? addon.store.constructor.name : 'NO_STORE');
      console.log('Addon config:', !!addon.config);
      console.log('Addon settings:', !!addon.settings);
      
      // Check if addon.settings exists (this is the actual store interface)
      if (!addon.settings && !addon.store) {
        console.error('No store available - neither addon.settings nor addon.store exists');
        return res.status(500).json({ 
          error: 'Store not initialized', 
          details: 'Neither addon.settings nor addon.store is available' 
        });
      }
      
      // Validate required fields
      if (!req.body.clientKey) {
        console.error('Missing clientKey in installation payload');
        return res.status(400).json({ error: 'Missing clientKey' });
      }
      
      if (!req.body.sharedSecret) {
        console.error('Missing sharedSecret in installation payload');
        return res.status(400).json({ error: 'Missing sharedSecret' });
      }
      
      // Store the installation data manually
      const installationData = {
        clientKey: req.body.clientKey,
        publicKey: req.body.publicKey,
        sharedSecret: req.body.sharedSecret,
        serverVersion: req.body.serverVersion,
        pluginsVersion: req.body.pluginsVersion,
        baseUrl: req.body.baseUrl,
        productType: req.body.productType,
        description: req.body.description,
        eventType: req.body.eventType,
        installedAt: new Date().toISOString()
      };
      
      console.log('Attempting to store installation data...');
      
      // Try to use addon.settings first, then fallback to addon.store
      const store = addon.settings || addon.store;
      console.log('Using store:', store.constructor.name);
      
      // Try to store the data using the proper saveInstallation method
      if (store.saveInstallation) {
        store.saveInstallation(installationData, req.body.clientKey)
          .then(() => {
            console.log('Installation data stored successfully via saveInstallation');
            console.log('Sending 204 response');
            res.status(204).end();
          })
          .catch(storeError => {
            console.error('Error storing installation data via saveInstallation:', storeError);
            console.error('Store error stack:', storeError.stack);
            res.status(500).json({ 
              error: 'Failed to store installation data', 
              details: storeError.message 
            });
          });
      } else if (store.set) {
        // Fallback to generic set method
        store.set('clientInfo', installationData, req.body.clientKey)
          .then(() => {
            console.log('Installation data stored successfully via set');
            console.log('Sending 204 response');
            res.status(204).end();
          })
          .catch(storeError => {
            console.error('Error storing installation data via set:', storeError);
            console.error('Store error stack:', storeError.stack);
            res.status(500).json({ 
              error: 'Failed to store installation data', 
              details: storeError.message 
            });
          });
      } else {
        console.error('Store has no saveInstallation or set method');
        res.status(500).json({ 
          error: 'Store has no available methods', 
          details: 'Neither saveInstallation nor set method found' 
        });
      }
        
    } catch (error) {
      console.error('Installation handler exception:', error);
      console.error('Exception stack:', error.stack);
      res.status(500).json({ error: 'Installation exception', details: error.message });
    }
    console.log('=================================\n');
  });

  app.get("/", (req, res) => {
    res.redirect("/atlassian-connect.json");
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    console.log('\n=== HEALTH CHECK ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Base URL:', addon.config.localBaseUrl());
    console.log('Environment:', process.env.NODE_ENV);
    console.log('==================\n');
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      baseUrl: addon.config.localBaseUrl(),
      environment: process.env.NODE_ENV
    });
  });

  app.get("/viewer", addon.authenticate(), (req, res) => {
    res.render("viewer.hbs");
  });

  app.get("/editor", addon.authenticate(), async (req, res) => {
    let access_token, user;
    try {
      access_token = await fetchToken(req.context.http, req.context.userAccountId)
      user = access_token ? await mermaidAPI.getUser(access_token) : undefined
    } catch (e) {}

    const auth = user ? {} : await mermaidAPI.getAuthorizationData()

    res.render("editor.hbs", {
      MC_BASE_URL: MC_BASE_URL,
      mcAccessToken: user ? access_token : '',
      loginURL: auth.url,
      loginState: auth.state,
      user: user ? JSON.stringify(user) : 'null'
    });
  });

  app.get("/check_token", addon.checkValidToken(), async (req, res) => {
    if (!req.query.state) {
      return res.status(404).end();
    }
    const token = await mermaidAPI.getToken(req.query.state);
    if (!token) {
      return res.status(404).end();
    }
    await mermaidAPI.delToken(req.query.state);

    const user = await mermaidAPI.getUser(token)

    try {
      await saveToken(req.context.http, req.context.userAccountId, token)
      return res.json({ token, user }).end();
    } catch (e) {
      console.error(e)
      res.status(503).end();
    }
  })

  app.post("/logout", addon.checkValidToken(), async (req, res) => {
    await saveToken(req.context.http, req.context.userAccountId, '')
    res.end();
  })

  app.get("/callback", async (req, res) => {
    let errorMessage;
    try {
      await mermaidAPI.handleAuthorizationResponse(req.query)
    } catch (e) {
      errorMessage = e.message;
    }

    res.render("authCallback.hbs", {
      errorMessage,
    })

  })
}

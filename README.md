# Mermaid chart confluence plugin

## Installation
1. Set up environment variables:
```
NODE_ENV=production
MC_CLIENT_ID=839d35ba-cfee-4c98-8cee-88f2d2caa0c4
MC_BASE_URL=https://test.mermaidchart.com
```
2. Configure application with `config.json` file (set up domain and DB connection) for production env
3. Run `npm run start`
4. [How to add plugin into atlassian marketplace](https://developer.atlassian.com/platform/marketplace/listing-connect-apps/)


### Configure diagram selection page
1. Attach plugin js to the page
```html
<script src="https://[confluence plugin domain]/js/plugin.js"></script>
```
2. Call function `window.CP.saveData(data)` on diagram selection (iframe will be closed automatically after execution). Example
```js
window.CP.saveData({
    documentID: 'c2f481f9-433f-4491-a9d4-811d7150122f',
    major: '0',
    minor: '1',
});
```
3. Call function `window.CP.cancel()` if you want close iframe without selecting diagram
4. Function `window.CP.getData()` returns current selection diagram data.
5. Example file [`/example/index.html`](/example/index.html)

## Development
1. Configure your local environment with following 
[guide (steps 1-3)](https://developer.atlassian.com/cloud/confluence/getting-started-with-connect/)
2. Add a credentials.json (copy from sample) file in your app directory with your information:
- **your-confluence-domain**: Use the domain of your cloud development site (for example, https://your-domain.atlassian.net).
- **username**: Use the email address of your Atlassian [account](https://confluence.atlassian.com/cloud/atlassian-account-for-users-873871199.html).
- **password**: Specify the [API token](https://confluence.atlassian.com/x/Vo71Nw).
- **authtoken**: [ngrock auth token](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Set up environment variables:
```
MC_CLIENT_ID=839d35ba-cfee-4c98-8cee-88f2d2caa0c4
MC_BASE_URL=https://test.mermaidchart.com
```
4. Start application `npm run start`

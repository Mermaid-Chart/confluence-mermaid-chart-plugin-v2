import {v4 as uuid} from 'uuid';
import fetch from 'node-fetch';
import {getEncodedSHA256Hash} from './index.js';

const defaultBaseURL = 'https://test.mermaidchart.com';

const CLIENT_KEY = 'all';

class MermaidChart {
    addon;
    clientID;
    baseURL;
    axios;
    redirectURI;
    URLS = {
        oauth: {
            authorize: (params) =>
                `/oauth/authorize?${new URLSearchParams(
                    Object.entries(params),
                ).toString()}`,
            token: `/oauth/token`,
        },
        rest: {
            users: {
                self: `/rest-api/users/me`,
            },
            documents: {
                get: (documentID) => {
                    return `/rest-api/documents/${documentID}`;
                },
            },
            projects: {
                list: `/rest-api/projects`,
                get: (projectID) => {
                    return {
                        documents: `/rest-api/projects/${projectID}/documents`,
                    };
                },
            },
        },
        raw: (
            document,
            theme = 'light',
        ) => {
            const base = `/raw/${document.documentID}?version=v${document.major}.${document.minor}&theme=${theme}&format=`;
            return {
                html: base + 'html',
                svg: base + 'svg',
                png: base + 'png',
            };
        },
        diagram: (
            d,
        ) => {
            const base = `/app/projects/${d.projectID}/diagrams/${d.documentID}/version/v${d.major}.${d.minor}`;
            return {
                self: base,
                edit: base + '/edit',
                view: base + '/view',
            };
        },
    };

    constructor({clientID, baseURL, redirectURI, addon}) {
        this.addon = addon;
        this.clientID = clientID;
        this.setBaseURL(baseURL || defaultBaseURL);
        if (redirectURI) {
            this.setRedirectURI(redirectURI);
        }
    }

    setRedirectURI(redirectURI) {
        this.redirectURI = redirectURI;
    }

    setBaseURL(baseURL = defaultBaseURL) {
        if (this.baseURL && this.baseURL === baseURL) {
            return;
        }
        this.baseURL = baseURL;
    }

    async getAuthorizationData({
        state,
        scope,
    } = {}) {
        if (!this.redirectURI) {
            throw new Error('redirectURI is not set');
        }

        const stateID = state ?? uuid();
        const codeVerifier= uuid();

        await this.setCodeVerifier(stateID, codeVerifier);

        const params = {
            client_id: this.clientID,
            redirect_uri: this.redirectURI,
            response_type: 'code',
            code_challenge_method: 'S256',
            code_challenge: await getEncodedSHA256Hash(
                codeVerifier,
            ),
            state: stateID,
            scope: scope ?? 'email',
        };

        setTimeout(async () => {
            await this.delCodeVerifier(stateID);
        }, 5 * 60 * 1000);

        const url = `${this.baseURL}${this.URLS.oauth.authorize(params)}`;
        return {
            url,
            state: stateID,
            scope: params.scope,
        };
    }

    async handleAuthorizationResponse(query) {
        const authorizationToken = query.code;
        const state = query.state;

        if (!authorizationToken) {
            throw new RequiredParameterMissingError('token');
        }
        if (!state) {
            throw new RequiredParameterMissingError('state');
        }

        const codeVerifier = await this.getCodeVerifier(state);
        // Check if it is a valid auth request started by the extension
        if (!codeVerifier) {
            throw new OAuthError('invalid_state');
        }

        const tokenResponse = await fetch(this.baseURL + this.URLS.oauth.token,
            {
                method: 'post',
                body: JSON.stringify({
                    client_id: this.clientID,
                    redirect_uri: this.redirectURI,
                    code_verifier: codeVerifier,
                    code: authorizationToken,
                }),
                headers: {
                    'Content-type': 'application/json',
                },
            },
        );

        if (!tokenResponse.ok) {
            throw new OAuthError(
                `invalid_token ${tokenResponse.status} ${tokenResponse.statusText}`);
        }

        await this.setToken(state, (await tokenResponse.json()).access_token)
        setTimeout(async () => {
            await this.delToken(state);
        }, 30 * 60 * 1000);
    }

    async getUser(accessToken) {
        console.log('\n=== MERMAID GET USER ===');
        console.log('Base URL:', this.baseURL);
        console.log('Access token provided:', !!accessToken);
        console.log('Token length:', accessToken?.length || 0);
        
        const url = `${this.baseURL}${this.URLS.rest.users.self}`;
        console.log('Request URL:', url);
        
        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            
            console.log('Response status:', response.status);
            console.log('Response OK:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error response:', errorText);
                console.log('=====================\n');
                throw new OAuthError("Invalid token to get user info");
            }
            
            const userData = await response.json();
            console.log('User data retrieved:', !!userData);
            if (userData) {
                console.log('User ID:', userData.id);
                console.log('User email:', userData.emailAddress);
            }
            console.log('=====================\n');
            
            return userData;
        } catch (error) {
            console.error('Error in getUser:', error);
            console.log('=====================\n');
            throw error;
        }
    }

    getEditURL(
        document,
    ) {
        const url = `${this.baseURL}${this.URLS.diagram(document).edit}`;
        return url;
    }

    async getDocumentAsPng(
        document,
        theme = 'light',
    ) {
        const png = await fetch(
            this.URLS.raw(document, theme).png
        );
        return await png.text();
    }

    async getRawDocument(
        document,
        theme = 'light',
    ) {
        const raw = await fetch(
            this.URLS.raw(document, theme).svg
        );
        return await raw.text();
    }

    async getCodeVerifier(state) {
        return await this.addon.settings.get(`state:${state}:code`, CLIENT_KEY);
    }

    async setCodeVerifier(state, code) {
        return await this.addon.settings.set(`state:${state}:code`, code,
            CLIENT_KEY);
    }

    async delCodeVerifier(state) {
        return await this.addon.settings.del(`state:${state}:code`, CLIENT_KEY);
    }

    async getToken(state) {
        return await this.addon.settings.get(`state:${state}:token`,
            CLIENT_KEY);
    }

    async setToken(state, code) {
        return await this.addon.settings.set(`state:${state}:token`, code,
            CLIENT_KEY);
    }

    async delToken(state) {
        return await this.addon.settings.del(`state:${state}:token`,
            CLIENT_KEY);
    }
}

class RequiredParameterMissingError extends Error {
    constructor(parameterName) {
        super(`Required parameter ${parameterName} is missing`);
    }
}

class OAuthError extends Error {
    constructor(message) {
        super(message);
    }
}

export {
    MermaidChart,
};

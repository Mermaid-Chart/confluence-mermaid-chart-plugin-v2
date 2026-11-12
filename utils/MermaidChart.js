import { createHash, randomUUID } from 'node:crypto';

const defaultBaseURL = 'https://test.mermaidchart.com';

const CLIENT_KEY = 'all';

class MermaidChart {
    store;
    clientID;
    baseURL;
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
        },
    };

    constructor({clientID, baseURL, redirectURI, store}) {
        this.store = store;
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
        trackingParams
    } = {}) {
        if (!this.redirectURI) {
            throw new Error('redirectURI is not set');
        }

        const stateID = state ?? randomUUID();
        const codeVerifier = randomUUID();

        await this.setCodeVerifier(stateID, codeVerifier);

        const params = {
            client_id: this.clientID,
            redirect_uri: this.redirectURI,
            response_type: 'code',
            code_challenge_method: 'S256',
            code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
            state: stateID,
            scope: scope ?? 'email',
            utm_source: trackingParams?.utm_source || 'mermaid_chart_confluence_plugin',
            utm_medium: trackingParams?.utm_medium || 'confluence',
            utm_campaign: trackingParams?.utm_campaign || 'confluence_plugin'
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

        await this.setToken(state, (await tokenResponse.json()).access_token);
        setTimeout(async () => {
            await this.delToken(state);
        }, 30 * 60 * 1000);
    }

    async getUser(accessToken) {
        const response = await fetch(
            `${this.baseURL}${this.URLS.rest.users.self}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
        if (!response.ok) {
            throw new OAuthError('Invalid token to get user info');
        }
        return (await response.json());
    }

    async getCodeVerifier(state) {
        return await this.store.get(`state:${state}:code`, CLIENT_KEY);
    }

    async setCodeVerifier(state, code) {
        return await this.store.set(`state:${state}:code`, code, CLIENT_KEY);
    }

    async delCodeVerifier(state) {
        return await this.store.del(`state:${state}:code`, CLIENT_KEY);
    }

    async getToken(state) {
        return await this.store.get(`state:${state}:token`, CLIENT_KEY);
    }

    async setToken(state, code) {
        return await this.store.set(`state:${state}:token`, code, CLIENT_KEY);
    }

    async delToken(state) {
        return await this.store.del(`state:${state}:token`, CLIENT_KEY);
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

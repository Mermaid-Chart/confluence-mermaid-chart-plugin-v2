import {Buffer} from 'buffer';

const fetchToken = async (httpClient, atlassianAccountId) => {
    return new Promise((resolve, reject) => {
        httpClient.asUserByAccountId(atlassianAccountId).get(
            {
                url: `/rest/api/user/${atlassianAccountId}/property/token?jsonValue=true`,
                headers: {
                    'Accept': 'application/json',
                },
            },
            function(err, _, body) {
                if (err) {
                    console.error(
                        'Failed on reading user property "token"',
                    );
                    reject(err);
                    return;
                }
                const response = JSON.parse(body);
                const token = (response.value || {}).token || '';
                resolve(token);
            },
        );
    });
};
const saveToken = async (httpClient, atlassianAccountId, token) => {
    return new Promise((resolve, reject) => {
        const requestOpt = {
            url: `/rest/api/user/${atlassianAccountId}/property/token`,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({value: {token}}),
        }

        httpClient.asUserByAccountId(atlassianAccountId).put(requestOpt, (err, res, body) => {
            if (err || res.statusCode > 399) {
                httpClient.asUserByAccountId(atlassianAccountId).post(requestOpt, (err2, res2, body2) => {
                    console.log("post", err2, body2);
                    if (err2 || res2.statusCode !== 200) {
                        console.error('Failed on saving user property "token"', err2, res2.statusCode);
                        return reject(err);
                    }
                });
            }
            resolve(token);
        });
    });
};

const getEncodedSHA256Hash = async (str) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);

    return Buffer.from(hash).
        toString('base64').
        replace(/\+/g, '-').
        replace(/\//g, '_').
        replace(/=+$/, '');
};

export {
    fetchToken,
    saveToken,
    getEncodedSHA256Hash,
};

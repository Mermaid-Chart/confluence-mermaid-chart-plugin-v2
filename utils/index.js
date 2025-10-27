import {Buffer} from 'buffer';

const fetchToken = async (httpClient, atlassianAccountId) => {
    console.log('\n=== FETCH TOKEN ===');
    console.log('Fetching token for account ID:', atlassianAccountId);
    
    return new Promise((resolve, reject) => {
        httpClient.asUserByAccountId(atlassianAccountId).get(
            {
                url: `/rest/api/user/${atlassianAccountId}/property/token?jsonValue=true`,
                headers: {
                    'Accept': 'application/json',
                },
            },
            function(err, res, body) {
                if (err) {
                    console.error('Failed on reading user property "token":', err);
                    console.log('==================\n');
                    reject(err);
                    return;
                }
                
                console.log('Response status:', res?.statusCode);
                console.log('Response body:', body);
                
                try {
                    const response = JSON.parse(body);
                    const token = (response.value || {}).token || '';
                    console.log('Token found:', !!token);
                    console.log('Token length:', token.length);
                    console.log('==================\n');
                    resolve(token);
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    console.log('==================\n');
                    resolve('');
                }
            },
        );
    });
};
const saveToken = async (httpClient, atlassianAccountId, token) => {
    console.log('\n=== SAVE TOKEN ===');
    console.log('Saving token for account ID:', atlassianAccountId);
    console.log('Token provided:', !!token);
    console.log('Token length:', token?.length || 0);
    
    return new Promise((resolve, reject) => {
        const requestOpt = {
            url: `/rest/api/user/${atlassianAccountId}/property/token`,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({value: {token}}),
        }

        console.log('Attempting PUT request...');
        httpClient.asUserByAccountId(atlassianAccountId).put(requestOpt, (err, res, body) => {
            console.log('PUT response - Status:', res?.statusCode, 'Error:', !!err);
            
            if (err || res.statusCode > 399) {
                console.log('PUT failed, trying POST...');
                httpClient.asUserByAccountId(atlassianAccountId).post(requestOpt, (err2, res2, body2) => {
                    console.log('POST response - Status:', res2?.statusCode, 'Error:', !!err2);
                    console.log("POST details:", err2, body2);
                    
                    if (err2 || res2.statusCode !== 200) {
                        console.error('Failed on saving user property "token"', err2, res2.statusCode);
                        console.log('==================\n');
                        return reject(err2 || new Error(`POST failed with status ${res2.statusCode}`));
                    }
                    
                    console.log('Token saved successfully via POST');
                    console.log('==================\n');
                    resolve(token);
                });
            } else {
                console.log('Token saved successfully via PUT');
                console.log('==================\n');
                resolve(token);
            }
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

// This function runs on Netlify's servers, not in the browser.
// It has secure access to your secret keys.

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { code, redirectUrl } = JSON.parse(event.body);

        if (!code || !redirectUrl) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Authorization code or redirectUrl is missing.' }) };
        }

        const CLIENT_ID = process.env.HOMEY_CLIENT_ID;
        const CLIENT_SECRET = process.env.HOMEY_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
             return { statusCode: 500, body: JSON.stringify({error: 'Server configuration is missing.'}) };
        }
        
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', redirectUrl);
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);

        const response = await fetch('https://api.athom.com/oauth2/token', {
            method: 'POST',
            // FIKS: Legger til header for å være 100% sikker på formatet
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const responseBody = await response.text();

        if (!response.ok) {
            console.error('Error from Homey API:', responseBody);
            return { 
                statusCode: response.status, 
                body: responseBody 
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: responseBody,
        };

    } catch (error) {
        console.error('Serverless function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.', details: error.message }),
        };
    }
};


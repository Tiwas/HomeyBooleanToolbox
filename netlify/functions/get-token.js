// This function runs on Netlify's servers, not in the browser.
// It uses a more standard require syntax.
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { code } = JSON.parse(event.body);
        if (!code) {
            return { statusCode: 400, body: 'Authorization code is missing.' };
        }

        const { HOMEY_CLIENT_ID, HOMEY_CLIENT_SECRET } = process.env;
        if (!HOMEY_CLIENT_ID || !HOMEY_CLIENT_SECRET) {
             return { statusCode: 500, body: JSON.stringify({error: 'Server configuration is missing.'}) };
        }
        
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: HOMEY_CLIENT_ID,
            client_secret: HOMEY_CLIENT_SECRET,
        });

        const response = await fetch('https://api.athom.com/oauth2/token', {
            method: 'POST',
            body: params,
        });

        const responseBody = await response.text();
        if (!response.ok) {
            console.error('Error from Homey API:', responseBody);
            return { 
                statusCode: response.status, 
                body: JSON.stringify({ error: 'Error fetching token from Homey.', details: responseBody })
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


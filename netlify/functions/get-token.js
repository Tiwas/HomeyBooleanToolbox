// This function runs on Netlify's servers, not in the browser.
// It has secure access to your secret keys.

// Import 'fetch' to make network requests
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // We only accept POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { code } = JSON.parse(event.body);
        if (!code) {
            return { statusCode: 400, body: 'Authorization code is missing.' };
        }

        // Get secrets from Netlify's environment variables
        const CLIENT_ID = process.env.HOMEY_CLIENT_ID;
        const CLIENT_SECRET = process.env.HOMEY_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
             return { statusCode: 500, body: JSON.stringify({error: 'Server configuration is missing.'}) };
        }

        const response = await fetch('https://api.athom.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }),
        });

        const responseBody = await response.text();
        if (!response.ok) {
            console.error('Error from Homey API:', responseBody);
            return { statusCode: response.status, body: `Error fetching token: ${responseBody}` };
        }

        // Send the secure token data back to the browser
        return {
            statusCode: 200,
            body: responseBody,
        };

    } catch (error) {
        console.error('Serverless function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.' }),
        };
    }
};


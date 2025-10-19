// This function runs on Netlify's servers, not in the browser.
// It has secure access to your secret keys.

// Using dynamic import for node-fetch as it's an ES Module
// This is a more modern and robust approach for Netlify Functions.
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event, context) => {
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
        
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);

        const response = await fetch('https://api.athom.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const responseBody = await response.text();
        if (!response.ok) {
            console.error('Error from Homey API:', responseBody);
            // Return the actual error from Homey API for better debugging
            return { 
                statusCode: response.status, 
                body: JSON.stringify({ error: 'Error fetching token from Homey.', details: responseBody })
            };
        }

        // Send the secure token data back to the browser
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


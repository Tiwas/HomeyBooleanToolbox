// Vercel Serverless Function
// This function runs on Vercel's servers, not in the browser.
// It has secure access to your secret keys.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { code, redirectUrl } = req.body;

        if (!code || !redirectUrl) {
            return res.status(400).json({ 
                error: 'Authorization code or redirectUrl is missing.' 
            });
        }

        const CLIENT_ID = process.env.HOMEY_CLIENT_ID;
        const CLIENT_SECRET = process.env.HOMEY_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
            return res.status(500).json({ 
                error: 'Server configuration is missing.' 
            });
        }
        
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', redirectUrl);
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
            console.error('Error from Homey API:', response.status, responseBody);
            return res.status(response.status).send(responseBody);
        }

        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .send(responseBody);

    } catch (error) {
        console.error('Serverless function error:', error);
        return res.status(500).json({ 
            error: 'An internal server error occurred.', 
            details: error.message 
        });
    }
}
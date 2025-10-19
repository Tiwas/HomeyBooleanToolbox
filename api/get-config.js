// Vercel Serverless Function
// This function's only job is to securely provide the public CLIENT_ID to the browser.

export default async function handler(req, res) {
    const CLIENT_ID = process.env.HOMEY_CLIENT_ID;

    if (!CLIENT_ID) {
        return res.status(500).json({ 
            error: 'Server configuration for HOMEY_CLIENT_ID is missing.' 
        });
    }

    return res.status(200).json({ clientId: CLIENT_ID });
}
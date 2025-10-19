// This function's only job is to securely provide the public CLIENT_ID to the browser.
exports.handler = async function(event, context) {
    
    const CLIENT_ID = process.env.HOMEY_CLIENT_ID;

    if (!CLIENT_ID) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Server configuration for HOMEY_CLIENT_ID is missing.' }) 
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ clientId: CLIENT_ID }),
    };
};

# Homey Boolean Editor - Setup Guide

A web-based editor for managing Homey Boolean Toolbox devices and creating boolean expressions.

> **Note:** This is the setup guide for the Boolean Editor specifically. See the main [README.md](../README.md) for information about the Boolean Toolbox app itself.

## 🚀 Quick Start

### Option 1: Use GitHub Pages (Recommended)

The app is already hosted at: **https://tiwas.github.io/HomeyBooleanToolbox/homey-boolean-editor.html**

### Option 2: Host it yourself

1. Download the `homey-boolean-editor.html` file
2. Upload it to any web hosting service (GitHub Pages, Netlify, Vercel, etc.)
3. Note your hosted URL - you'll need it for the next step

## 🔧 Setup Instructions

### Step 1: Create Homey API Client

1. Go to [Homey API Clients](https://tools.developer.homey.app/api/clients)
2. Click "Add client" or "Create new client"
3. Fill in the form:
   - **Name**: `Boolean Editor` (or any name you prefer)
   - **Redirect URL**: `https://tiwas.github.io/HomeyBooleanToolbox/homey-boolean-editor.html`
     - ⚠️ **Important**: Use the exact URL where you host the app
     - If hosting yourself, replace with your own URL
   - **Scopes**: Check the following boxes:
     - ✅ `homey.zone.readonly` - Required to read zone information
     - ✅ `homey.device.readonly` - Required to read device information
     - ✅ `homey.device.control` - Required to modify device settings
4. Click "Create"
5. **Copy both the Client ID and Client Secret** - you'll need these in the next step

### Step 2: Configure the App

1. Open the app in your browser: [Boolean Editor](https://tiwas.github.io/HomeyBooleanToolbox/homey-boolean-editor.html)
2. You'll see the API Setup screen
3. Paste your **Client ID** and **Client Secret** from Step 1
4. Click "Save and Continue"
5. Log in with your Homey account

## 📁 File Structure

```
homey-boolean-editor.html    # Main application (all-in-one file)
resources/
  lang.en.json               # English translations
  lang.no.json               # Norwegian translations
  lang.de.json               # German translations
  lang.fr.json               # French translations
  lang.nl.json               # Dutch translations
```

## 🌍 Language Support

The app supports 5 languages:
- 🇬🇧 English
- 🇳🇴 Norwegian (Norsk)
- 🇩🇪 German (Deutsch)
- 🇫🇷 French (Français)
- 🇳🇱 Dutch (Nederlands)

Language files should be placed in a `resources/` folder next to the HTML file.

## 🔒 Security & Privacy

- Your Client ID and Client Secret are stored **locally in your browser** (localStorage)
- No data is sent to any third-party servers
- All communication is directly between your browser and Homey's API
- You can change or delete your credentials at any time using the "⚙️ API Settings" button

## 🛠️ Features

### Main Menu
1. **Edit existing devices** - View and modify settings for Boolean Toolbox devices
2. **Create new expression** - Build boolean formulas using device capabilities
3. **Import from JSON** - Start with existing device/capability configurations

### Creating Expressions
- Select 2-10 device capabilities
- Build boolean formulas using:
  - Variables: A-J
  - Operators: AND, OR, NOT, XOR
  - Parentheses for grouping

### Device Management
- View all Boolean Toolbox devices organized by zone
- Edit device settings
- Debug view to find device driver IDs

## 🐛 Troubleshooting

### "Wrong Domain" Error
If you see this error, it means the redirect URL in your Homey API Client doesn't match where you're accessing the app from. Make sure:
1. Your Homey API Client redirect URL matches exactly where the app is hosted
2. Include `https://` in the URL
3. No trailing slashes

### Can't Log In
1. Check that your Client ID and Client Secret are correct
2. Verify the redirect URL matches in both the API Client settings and where you're accessing the app
3. **Make sure you selected the required scopes** (homey.zone.readonly, homey.device.readonly, homey.device.control)
4. Try clearing your browser's localStorage and setting up again

### "Cannot read properties of undefined (reading 'getDevices')" Error
This error means the API scopes are missing or incorrect:
1. Go back to [Homey API Clients](https://tools.developer.homey.app/api/clients)
2. Edit your client
3. Make sure these scopes are checked:
   - ✅ `homey.zone.readonly`
   - ✅ `homey.device.readonly`
   - ✅ `homey.device.control`
4. Save the changes
5. In the app, click "⚙️ API Settings" and re-enter your credentials (this forces a new authentication)

### Language Files Not Loading
The app will fall back to English if language files can't be loaded. To use other languages:
1. Create a `resources/` folder in the same location as the HTML file
2. Add the language JSON files to this folder
3. Refresh the page

## 📝 Notes

- The app requires internet connection to communicate with Homey's cloud API
- Your Homey must be online and accessible
- First-time setup requires creating a Homey API Client (one-time process)
- Your credentials are saved locally and persist between sessions

## 🔄 Updating API Credentials

To change your API credentials:
1. Click the "⚙️ API Settings" button (top right)
2. Confirm you want to change credentials (this will log you out)
3. Enter new Client ID and Client Secret
4. Click "Save and Continue"

## 💡 Tips

- The app works entirely in your browser - no backend needed
- You can host the HTML file anywhere that supports HTTPS
- For development/testing, you can use `http://localhost` URLs
- The redirect URL must be exact - including protocol (https://) and no trailing slash

## 📜 License

This is a community tool for Homey Boolean Toolbox users.
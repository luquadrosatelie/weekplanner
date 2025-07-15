import os
import logging
import json
from flask import Flask, render_template

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

@app.route("/")
def index():
    """Main application route"""
    # --- SECURITY WARNING ---
    # Hardcoding credentials is not recommended for production environments.
    # It is safer to use environment variables.
    firebase_api_key = "AIzaSyDkqxqW2oVKsqroSDdUA05D03hgf729tRk"
    firebase_project_id = "weekplannerpro"
    firebase_app_id = "1:764033294528:web:0377a5ee7b4aaf70f24d25"
    
    firebase_config = None
    firebase_is_available = False

    # Check if all required Firebase credentials are provided
    if firebase_api_key and firebase_project_id and firebase_app_id:
        firebase_is_available = True
        # Construct the complete Firebase config dictionary in Python.
        # This is the single source of truth for the configuration.
        firebase_config = {
            "apiKey": firebase_api_key,
            "authDomain": f"{firebase_project_id}.firebaseapp.com",
            "projectId": firebase_project_id,
            # CORRECTED: Using the correct storage bucket format from the original file.
            "storageBucket": f"{firebase_project_id}.firebasestorage.app",
            # The messagingSenderId is the numeric part of the appId
            "messagingSenderId": firebase_app_id.split(":")[1],
            "appId": firebase_app_id,
            # This can be found in your Firebase project settings under "General"
            "measurementId": "G-MB93M4XSCW" 
        }

    return render_template(
        "index.html",
        # Pass the config as a valid JSON string.
        # The `json.dumps` function handles the conversion.
        firebase_config_json=json.dumps(firebase_config),
        firebase_is_available=firebase_is_available
    )

@app.route("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

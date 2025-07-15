import os
import logging
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
    
    return render_template(
        "index.html",
        firebase_api_key=firebase_api_key,
        firebase_project_id=firebase_project_id,
        firebase_app_id=firebase_app_id,
        # Since we are hardcoding the credentials, this will always be true.
        firebase_is_available=True
    )

@app.route("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

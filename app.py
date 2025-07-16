import os
import logging
from flask import Flask, render_template

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

@app.route("/")
def index():
    """
    Main application route.
    This has been simplified to remove all Firebase-related logic
    and serve the main HTML file.
    """
    return render_template("index.html")

@app.route("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy"}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

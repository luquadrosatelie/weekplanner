// Firebase configuration and initialization
// This module provides the Firebase app, auth, and db instances

export const firebaseAvailable = window.firebaseAvailable || false;

export let auth = null;
export let db = null;

// Directly use the Firebase instances initialized in index.html
if (firebaseAvailable) {
    auth = window.auth;
    db = window.db;
    if (auth && db) {
        console.log('Firebase initialized and linked successfully.');
    } else {
        console.error('Firebase objects not found on window. Make sure initialization in index.html is correct.');
    }
} else {
    console.warn('Firebase not available - running in offline mode.');
}

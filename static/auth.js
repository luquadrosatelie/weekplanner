import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut as firebaseSignOut,
    onAuthStateChanged as firebaseOnAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

import { auth, firebaseAvailable } from './firebase-config.js';

const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
    if (!firebaseAvailable || !auth) {
        throw new Error('Firebase não está disponível');
    }

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // CRITICAL: Clear the offline mode preference on a successful login.
        // This ensures the app doesn't fall back to offline mode on the next page load.
        localStorage.removeItem('planner-offline-mode');
        
        console.log('User signed in:', user.displayName);
        return user;
    } catch (error) {
        console.error('Error during sign in:', error);
        
        // Handle specific error codes
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                throw new Error('Login cancelado pelo usuário');
            case 'auth/popup-blocked':
                throw new Error('Popup bloqueado pelo navegador. Por favor, permita popups para este site.');
            case 'auth/network-request-failed':
                throw new Error('Erro de rede. Verifique sua conexão com a internet.');
            default:
                throw new Error('Erro durante o login: ' + error.message);
        }
    }
}

export async function signOut() {
    if (!firebaseAvailable || !auth) {
        throw new Error('Firebase não está disponível');
    }

    try {
        await firebaseSignOut(auth);
        console.log('User signed out');
    } catch (error) {
        console.error('Error during sign out:', error);
        throw new Error('Erro durante o logout: ' + error.message);
    }
}

export function onAuthStateChanged(callback) {
    if (!firebaseAvailable || !auth) {
        // If Firebase is not available, immediately call the callback with null (no user)
        callback(null);
        return () => {}; // Return an empty unsubscribe function
    }

    // Otherwise, use the real Firebase listener
    return firebaseOnAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
    if (!firebaseAvailable || !auth) {
        return null;
    }
    
    return auth.currentUser;
}

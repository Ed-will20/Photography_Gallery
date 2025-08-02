// Firebase Configuration - Fixed for compat SDK
// Using compat SDK syntax since we're loading Firebase via script tags

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmPjoPeH_z2AAAKkqqAy-CT_3icsVGe9s",
  authDomain: "photogallery-3eaf9.firebaseapp.com",
  projectId: "photogallery-3eaf9",
  storageBucket: "photogallery-3eaf9.firebasestorage.app",
  messagingSenderId: "255323796438",
  appId: "1:255323796438:web:756dae46d96b9073aeaa77",
  measurementId: "G-GNZ1E8GYGG"
};

// Wait for Firebase to be loaded
function initializeFirebaseServices() {
  try {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase not loaded yet');
      return false;
    }

    // Initialize Firebase
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized successfully');
    }

    // Initialize services using the compat SDK
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Configure Google Auth Provider
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.addScope('profile');
    googleProvider.addScope('email');

    // Test services
    console.log('✅ Auth service:', auth);
    console.log('✅ Firestore service:', db);
    console.log('✅ Storage service:', storage);
    console.log('✅ Google Provider:', googleProvider);

    // Export for use in other files
    window.firebaseServices = {
      auth,
      db,
      storage,
      googleProvider
    };

    console.log('✅ Firebase services exported to window');
    return true;

  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Firebase initialization failed. Please check the console for details.');
    return false;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure Firebase scripts are loaded
    setTimeout(initializeFirebaseServices, 100);
  });
} else {
  // DOM already loaded
  setTimeout(initializeFirebaseServices, 100);
  
}
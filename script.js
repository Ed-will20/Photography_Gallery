// ===========================================
// GLOBAL VARIABLES & STATE MANAGEMENT
// ===========================================

// Firebase services (imported from firebase-config.js)
let auth, db, storage, googleProvider;

// Application state
let currentUser = null;
let storageData = {
    albums: {},
    photos: []
};

// UI state variables
let currentAlbum = '';
let currentModalIndex = 0;
let currentAlbumPhotos = [];
let uploadQueue = [];
let totalStorageUsed = 0;

// ===========================================
// INITIALIZATION & AUTHENTICATION
// ===========================================

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, waiting for Firebase...');
    
    // Wait for Firebase to initialize with retries
    let retryCount = 0;
    const maxRetries = 10;
    
    function waitForFirebase() {
        const services = window.firebaseServices;
        if (services) {
            console.log('✅ Firebase services found, initializing app...');
            auth = services.auth;
            db = services.db;
            storage = services.storage;
            googleProvider = services.googleProvider;
            
            // Set up authentication state listener
            auth.onAuthStateChanged(handleAuthStateChange);
            
            // Set up UI event listeners
            setupEventListeners();
            
            // Check online/offline status
            setupConnectionMonitoring();
            
            console.log('✅ App initialization complete');
        } else {
            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`⏳ Waiting for Firebase services... (${retryCount}/${maxRetries})`);
                setTimeout(waitForFirebase, 200);
            } else {
                console.error('❌ Firebase services not available after retries');
                showError('Failed to initialize Firebase services. Please refresh the page.');
            }
        }
    }
    
    // Start checking for Firebase
    setTimeout(waitForFirebase, 100);
});

/**
 * Show error message to user
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff4444;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 10000;
        font-weight: bold;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Handle authentication state changes
 */
function handleAuthStateChange(user) {
    console.log('Auth state changed:', user ? user.displayName : 'No user');
    
    if (user) {
        currentUser = user;
        showGallerySection();
        updateUserInfo();
        loadUserData();
    } else {
        currentUser = null;
        showAuthSection();
        // Clear local data
        storageData = { albums: {}, photos: [] };
        updateStats();
    }
}

/**
 * Show authentication section
 */
function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('gallerySection').style.display = 'none';
}

/**
 * Show gallery section
 */
function showGallerySection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('gallerySection').style.display = 'block';
}

/**
 * Update user information in header
 */
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;
        document.getElementById('userPhoto').src = currentUser.photoURL || 'https://via.placeholder.com/40';
        document.getElementById('userPhoto').alt = currentUser.displayName || 'User';
    }
}

/**
 * Sign in with Google
 */
function signInWithGoogle() {
    console.log('Sign in button clicked');
    
    if (!auth || !googleProvider) {
        console.error('Auth services not available');
        showError('Authentication services not ready. Please wait and try again.');
        return;
    }
    
    console.log('Starting Google sign-in...');
    updateSyncStatus('Signing in...', '🔄');
    
    auth.signInWithPopup(googleProvider)
        .then((result) => {
            console.log('✅ Successfully signed in:', result.user.displayName);
            updateSyncStatus('Signed in successfully', '✅');
            setTimeout(() => updateSyncStatus('Loading...', '🔄'), 1000);
        })
        .catch((error) => {
            console.error('❌ Sign-in error:', error);
            updateSyncStatus('Sign-in failed', '❌');
            
            let errorMessage = 'Sign-in failed: ';
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage += 'Sign-in popup was closed';
                    break;
                case 'auth/popup-blocked':
                    errorMessage += 'Sign-in popup was blocked by browser';
                    break;
                case 'auth/cancelled-popup-request':
                    errorMessage += 'Another sign-in popup is already open';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            showError(errorMessage);
        });
}

/**
 * Sign out user
 */
function signOut() {
    if (!auth) {
        console.error('Auth service not available');
        return;
    }
    
    auth.signOut().then(() => {
        console.log('✅ User signed out');
        updateSyncStatus('Signed out', '✅');
    }).catch((error) => {
        console.error('❌ Sign-out error:', error);
        showError('Sign-out failed: ' + error.message);
    });
}

// ===========================================
// DATA MANAGEMENT & CLOUD SYNC
// ===========================================

/**
 * Load user data from Firestore
 */
async function loadUserData() {
    if (!currentUser || !db) {
        console.error('User not authenticated or Firestore not available');
        return;
    }

    try {
        updateSyncStatus('Loading your photos...', '🔄');
        
        // Initialize albums
        storageData.albums = { 'All Photos': [], 'Favorites': [] };
        storageData.photos = [];
        totalStorageUsed = 0;

        // Load albums
        try {
            const albumsRef = db.collection('users').doc(currentUser.uid).collection('albums');
            const albumsSnapshot = await albumsRef.get();
            
            albumsSnapshot.forEach(doc => {
                if (doc.id !== 'All Photos' && doc.id !== 'Favorites') {
                    storageData.albums[doc.id] = [];
                }
            });
        } catch (error) {
            console.log('No albums found or error loading albums:', error.message);
        }

        // Load photos
        try {
            const photosRef = db.collection('users').doc(currentUser.uid).collection('photos');
            const photosSnapshot = await photosRef.get();
            
            photosSnapshot.forEach(doc => {
                const photoData = doc.data();
                const photo = {
                    id: doc.id,
                    name: photoData.name || 'Untitled',
                    src: photoData.downloadURL || photoData.src,
                    album: photoData.album || 'General',
                    size: photoData.size || 0,
                    isFavorite: photoData.isFavorite || false,
                    uploadDate: photoData.uploadDate
                };
                
                storageData.photos.push(photo);
                storageData.albums['All Photos'].push(photo);
                
                // Ensure album exists
                if (!storageData.albums[photo.album]) {
                    storageData.albums[photo.album] = [];
                }
                
                // Add to specific album
                storageData.albums[photo.album].push(photo);

                // Add to favorites if needed
                if (photo.isFavorite) {
                    storageData.albums['Favorites'].push(photo);
                }

                // Calculate storage used
                totalStorageUsed += photo.size;
            });
        } catch (error) {
            console.log('No photos found or error loading photos:', error.message);
        }

        // Update UI
        initializeAlbums();
        updateAlbumSelect();
        updateAlbumTabs();
        showAllPhotos();
        updateStats();
        updateSyncStatus('Synced', '🟢');

    } catch (error) {
        console.error('Error loading user data:', error);
        updateSyncStatus('Sync failed', '❌');
        setTimeout(() => updateSyncStatus('Offline', '🔴'), 3000);
    }
}

/**
 * Save photo metadata to Firestore
 */
async function savePhotoToFirestore(photo) {
    if (!currentUser || !db) {
        throw new Error('User not authenticated or Firestore not available');
    }

    try {
        const photosRef = db.collection('users').doc(currentUser.uid).collection('photos');
        await photosRef.doc(photo.id.toString()).set({
            name: photo.name,
            album: photo.album,
            downloadURL: photo.src,
            uploadDate: firebase.firestore.Timestamp.now(),
            size: photo.size || 0,
            isFavorite: photo.isFavorite || false
        });

        // Update album in Firestore
        const albumsRef = db.collection('users').doc(currentUser.uid).collection('albums');
        await albumsRef.doc(photo.album).set({
            name: photo.album,
            createdAt: firebase.firestore.Timestamp.now(),
            photoCount: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });

    } catch (error) {
        console.error('Error saving photo to Firestore:', error);
        throw error;
    }
}

/**
 * Delete photo from Firestore
 */
async function deletePhotoFromFirestore(photoId) {
    if (!currentUser || !db) {
        throw new Error('User not authenticated or Firestore not available');
    }

    try {
        const photosRef = db.collection('users').doc(currentUser.uid).collection('photos');
        await photosRef.doc(photoId.toString()).delete();
    } catch (error) {
        console.error('Error deleting photo from Firestore:', error);
        throw error;
    }
}

/**
 * Upload photo file to Firebase Storage
 */
async function uploadPhotoToStorage(file, photoId) {
    if (!currentUser || !storage) {
        throw new Error('User not authenticated or Storage not available');
    }

    try {
        const storageRef = storage.ref();
        const fileName = `${photoId}_${Date.now()}_${file.name}`;
        const photoRef = storageRef.child(`users/${currentUser.uid}/photos/${fileName}`);
        
        const uploadTask = photoRef.put(file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    updateUploadProgress(progress);
                },
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error uploading to storage:', error);
        throw error;
    }
}

/**
 * Delete photo from Firebase Storage
 */
async function deletePhotoFromStorage(photoUrl) {
    if (!currentUser || !storage || !photoUrl) return;

    try {
        const photoRef = storage.refFromURL(photoUrl);
        await photoRef.delete();
    } catch (error) {
        console.error('Error deleting photo from storage:', error);
        // Don't throw error as photo might already be deleted
    }
}

// ===========================================
// UI UPDATE FUNCTIONS
// ===========================================

/**
 * Update sync status indicator
 */
function updateSyncStatus(text, indicator) {
    const syncText = document.getElementById('syncText');
    const syncIndicator = document.getElementById('syncIndicator');
    const syncStatus = document.getElementById('syncStatus');
    
    if (syncText) syncText.textContent = text;
    if (syncIndicator) syncIndicator.textContent = indicator;
    
    // Add syncing class for animation
    if (syncStatus) {
        if (indicator === '🔄') {
            syncStatus.classList.add('syncing');
        } else {
            syncStatus.classList.remove('syncing');
        }
    }
}

/**
 * Update upload progress
 */
function updateUploadProgress(progress) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const uploadProgress = document.getElementById('uploadProgress');
    
    if (!uploadProgress) return;
    
    if (progress === 0) {
        uploadProgress.style.display = 'none';
    } else {
        uploadProgress.style.display = 'block';
        if (progressFill) progressFill.style.width = progress + '%';
        if (progressText) {
            if (progress === 100) {
                progressText.textContent = 'Processing...';
            } else {
                progressText.textContent = `Uploading... ${Math.round(progress)}%`;
            }
        }
    }
}

/**
 * Update statistics display
 */
function updateStats() {
    const totalPhotosEl = document.getElementById('totalPhotos');
    const totalAlbumsEl = document.getElementById('totalAlbums');
    const cloudStorageEl = document.getElementById('cloudStorage');
    
    if (totalPhotosEl) totalPhotosEl.textContent = storageData.photos.length;
    if (totalAlbumsEl) totalAlbumsEl.textContent = Math.max(0, Object.keys(storageData.albums).length - 2);
    if (cloudStorageEl) cloudStorageEl.textContent = formatBytes(totalStorageUsed);
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 MB';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Update the album selection dropdown
 */
function updateAlbumSelect() {
    const select = document.getElementById('albumSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select an album...</option>';
    
    Object.keys(storageData.albums).forEach(albumName => {
        if (albumName !== 'All Photos' && albumName !== 'Favorites') {
            const option = document.createElement('option');
            option.value = albumName;
            option.textContent = albumName;
            select.appendChild(option);
        }
    });
}

/**
 * Update the album tabs display
 */
function updateAlbumTabs() {
    const tabsContainer = document.getElementById('albumTabs');
    if (!tabsContainer) return;
    
    tabsContainer.innerHTML = '';

    Object.keys(storageData.albums).forEach(albumName => {
        const tab = document.createElement('div');
        tab.className = 'album-tab';
        
        if (albumName !== 'All Photos' && albumName !== 'Favorites') {
            tab.innerHTML = `
                <span onclick="showAlbum('${albumName}')">${albumName} (${storageData.albums[albumName].length})</span>
                <button class="album-delete-btn" onclick="event.stopPropagation(); deleteAlbum('${albumName}')" title="Delete album">×</button>
            `;
        } else {
            tab.textContent = `${albumName} (${storageData.albums[albumName].length})`;
            tab.onclick = () => showAlbum(albumName);
        }
        
        if (albumName === currentAlbum) {
            tab.classList.add('active');
        }
        tabsContainer.appendChild(tab);
    });
}

/**
 * Display photos in the gallery
 */
function displayPhotos() {
    const gallery = document.getElementById('gallery');
    const loadingSpinner = document.getElementById('loadingSpinner');
    
    if (!gallery) return;
    
    const photosToShow = currentAlbum ? storageData.albums[currentAlbum] || [] : storageData.photos;
    
    // Hide loading spinner
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    
    if (photosToShow.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <h3>No photos yet</h3>
                <p>Upload some photos to get started!</p>
            </div>
        `;
        return;
    }

    gallery.innerHTML = photosToShow.map((photo, index) => `
        <div class="photo-card" style="animation-delay: ${index * 0.1}s">
            <img src="${photo.src}" alt="${photo.name}" onclick="openModal(${index})" style="cursor: pointer;" loading="lazy">
            <div class="photo-actions">
                <button class="action-btn favorite-btn ${photo.isFavorite ? 'favorited' : ''}" 
                        onclick="event.stopPropagation(); toggleFavorite('${photo.id}')" 
                        title="${photo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                    ${photo.isFavorite ? '❤️' : '🤍'}
                </button>
                <button class="action-btn download-btn" onclick="event.stopPropagation(); downloadPhoto('${photo.id}')" title="Download photo">📥</button>
                <button class="action-btn delete-btn" onclick="event.stopPropagation(); deletePhoto('${photo.id}')" title="Delete photo">×</button>
            </div>
            <div class="photo-info">
                <div class="photo-name">${photo.name}</div>
                <div class="photo-album">Album: ${photo.album}</div>
            </div>
        </div>
    `).join('');
}

// ===========================================
// ALBUM MANAGEMENT FUNCTIONS
// ===========================================

/**
 * Initialize default albums if they don't exist
 */
function initializeAlbums() {
    if (!storageData.albums['All Photos']) {
        storageData.albums['All Photos'] = [];
    }
    if (!storageData.albums['Favorites']) {
        storageData.albums['Favorites'] = [];
    }
}

/**
 * Create a new album
 */
async function createAlbum() {
    const albumName = document.getElementById('albumName').value.trim();
    if (!albumName) {
        showError('Please enter an album name');
        return;
    }
    if (storageData.albums[albumName]) {
        showError('Album already exists');
        return;
    }

    try {
        updateSyncStatus('Creating album...', '🔄');
        
        storageData.albums[albumName] = [];
        
        // Save to Firestore
        if (currentUser && db) {
            const albumsRef = db.collection('users').doc(currentUser.uid).collection('albums');
            await albumsRef.doc(albumName).set({
                name: albumName,
                createdAt: firebase.firestore.Timestamp.now(),
                photoCount: 0
            });
        }
        
        updateAlbumSelect();
        updateAlbumTabs();
        updateStats();
        document.getElementById('albumName').value = '';
        updateSyncStatus('Album created', '✅');
        
        setTimeout(() => updateSyncStatus('Synced', '🟢'), 2000);
        
    } catch (error) {
        console.error('Error creating album:', error);
        updateSyncStatus('Failed to create album', '❌');
        showError('Failed to create album: ' + error.message);
    }
}

/**
 * Delete an album
 */
async function deleteAlbum(albumName) {
    if (albumName === 'All Photos' || albumName === 'Favorites') {
        showError('Cannot delete system albums');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the album "${albumName}"?\n\nThis will NOT delete the photos, they will remain in other albums.`)) {
        return;
    }

    try {
        updateSyncStatus('Deleting album...', '🔄');
        
        delete storageData.albums[albumName];
        
        // Delete from Firestore
        if (currentUser && db) {
            const albumsRef = db.collection('users').doc(currentUser.uid).collection('albums');
            await albumsRef.doc(albumName).delete();
        }
        
        if (currentAlbum === albumName) {
            currentAlbum = 'All Photos';
        }
        
        updateAlbumSelect();
        updateAlbumTabs();
        updateStats();
        displayPhotos();
        updateSyncStatus('Album deleted', '✅');
        
        setTimeout(() => updateSyncStatus('Synced', '🟢'), 2000);
        
    } catch (error) {
        console.error('Error deleting album:', error);
        updateSyncStatus('Failed to delete album', '❌');
        showError('Failed to delete album: ' + error.message);
    }
}

/**
 * Show specific album
 */
function showAlbum(albumName) {
    currentAlbum = albumName;
    updateAlbumTabs();
    displayPhotos();
}

/**
 * Show all photos
 */
function showAllPhotos() {
    showAlbum('All Photos');
}

// ===========================================
// PHOTO MANAGEMENT FUNCTIONS
// ===========================================

/**
 * Generate unique ID for photos
 */
function generatePhotoId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Upload photos to selected album
 */
async function uploadPhotos() {
    const fileInput = document.getElementById('photoUpload');
    const selectedAlbum = document.getElementById('albumSelect').value;
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (!selectedAlbum) {
        showError('Please select an album first');
        return;
    }
    
    if (!fileInput || !fileInput.files.length) {
        showError('Please select photos to upload');
        return;
    }

    if (!currentUser) {
        showError('Please sign in to upload photos');
        return;
    }

    try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        updateSyncStatus('Uploading photos...', '🔄');
        updateUploadProgress(1);

        const files = Array.from(fileInput.files);
        let completed = 0;
        let errors = [];

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const photoId = generatePhotoId();
                
                try {
                    // Upload to Firebase Storage
                    const downloadURL = await uploadPhotoToStorage(file, photoId);
                    
                    // Create photo object
                    const photo = {
                        id: photoId,
                        name: file.name,
                        src: downloadURL,
                        album: selectedAlbum,
                        size: file.size,
                        isFavorite: false
                    };
                    
                    // Save metadata to Firestore
                    await savePhotoToFirestore(photo);
                    
                    // Update local state
                    storageData.photos.push(photo);
                    
                    // Ensure album exists
                    if (!storageData.albums[selectedAlbum]) {
                        storageData.albums[selectedAlbum] = [];
                    }
                    
                    storageData.albums[selectedAlbum].push(photo);
                    storageData.albums['All Photos'].push(photo);
                    totalStorageUsed += file.size;
                    
                    completed++;
                    const progress = (completed / files.length) * 100;
                    updateUploadProgress(progress);
                    
                } catch (error) {
                    console.error('Error uploading file:', file.name, error);
                    errors.push(`${file.name}: ${error.message}`);
                }
            } else {
                errors.push(`${file.name}: Not an image file`);
            }
        }

        // Update UI
        updateStats();
        updateAlbumTabs();
        if (currentAlbum === selectedAlbum || currentAlbum === 'All Photos') {
            displayPhotos();
        }
        
        fileInput.value = '';
        updateUploadProgress(0);
        
        if (errors.length > 0) {
            updateSyncStatus('Upload completed with errors', '⚠️');
            console.error('Upload errors:', errors);
            showError(`Some files failed to upload. Check console for details.`);
        } else {
            updateSyncStatus('Upload complete', '✅');
        }
        
        setTimeout(() => updateSyncStatus('Synced', '🟢'), 2000);

    } catch (error) {
        console.error('Error during upload:', error);
        updateSyncStatus('Upload failed', '❌');
        showError('Upload failed: ' + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Photos';
    }
}

/**
 * Delete a photo
 */
async function deletePhoto(photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
        updateSyncStatus('Deleting photo...', '🔄');
        
        // Find photo
        const photoIndex = storageData.photos.findIndex(p => p.id === photoId);
        if (photoIndex === -1) {
            showError('Photo not found');
            return;
        }
        
        const photo = storageData.photos[photoIndex];
        
        // Delete from Firebase Storage
        if (photo.src && photo.src.includes('firebase')) {
            await deletePhotoFromStorage(photo.src);
        }
        
        // Delete from Firestore
        await deletePhotoFromFirestore(photoId);
        
        // Update storage usage
        if (photo.size) {
            totalStorageUsed -= photo.size;
        }
        
        // Remove from local state
        storageData.photos.splice(photoIndex, 1);
        
        // Remove from all relevant albums
        Object.keys(storageData.albums).forEach(albumName => {
            const albumPhotoIndex = storageData.albums[albumName].findIndex(p => p.id === photoId);
            if (albumPhotoIndex !== -1) {
                storageData.albums[albumName].splice(albumPhotoIndex, 1);
            }
        });
        
        updateStats();
        updateAlbumTabs();
        displayPhotos();
        updateSyncStatus('Photo deleted', '✅');
        
        setTimeout(() => updateSyncStatus('Synced', '🟢'), 2000);
        
    } catch (error) {
        console.error('Error deleting photo:', error);
        updateSyncStatus('Failed to delete photo', '❌');
        showError('Failed to delete photo: ' + error.message);
    }
}

/**
 * Download a photo
 */
function downloadPhoto(photoId) {
    const photo = storageData.photos.find(p => p.id === photoId);
    if (!photo) return;
    
    const link = document.createElement('a');
    link.href = photo.src;
    link.download = photo.name;
    link.target = '_blank';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Toggle favorite status of a photo
 */
async function toggleFavorite(photoId) {
    const photo = storageData.photos.find(p => p.id === photoId);
    if (!photo) return;
    
    try {
        const wasFavorite = photo.isFavorite;
        photo.isFavorite = !wasFavorite;
        
        // Update Firestore
        if (currentUser && db) {
            const photoRef = db.collection('users').doc(currentUser.uid).collection('photos').doc(photoId.toString());
            await photoRef.update({
                isFavorite: photo.isFavorite
            });
        }
        
        // Update favorites album
        const favoriteIndex = storageData.albums['Favorites'].findIndex(p => p.id === photoId);
        
        if (photo.isFavorite && favoriteIndex === -1) {
            storageData.albums['Favorites'].push(photo);
        } else if (!photo.isFavorite && favoriteIndex !== -1) {
            storageData.albums['Favorites'].splice(favoriteIndex, 1);
        }
        
        updateAlbumTabs();
        displayPhotos();
        
    } catch (error) {
        console.error('Error toggling favorite:', error);
        // Revert the change
        photo.isFavorite = !photo.isFavorite;
        showError('Failed to update favorite status: ' + error.message);
    }
}

// ===========================================
// MODAL FUNCTIONS
// ===========================================

/**
 * Open modal with photo at specified index
 */
function openModal(index) {
    currentAlbumPhotos = currentAlbum ? storageData.albums[currentAlbum] || [] : storageData.photos;
    currentModalIndex = index;
    showModalImage();
    document.getElementById('imageModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

/**
 * Close the modal
 */
function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

/**
 * Display current image in modal
 */
function showModalImage() {
    if (currentAlbumPhotos.length === 0) return;
    
    const photo = currentAlbumPhotos[currentModalIndex];
    if (!photo) return;
    
    document.getElementById('modalImage').src = photo.src;
    document.getElementById('modalPhotoName').textContent = photo.name;
    document.getElementById('modalPhotoDetails').textContent = 
        `Album: ${photo.album} • ${currentModalIndex + 1} of ${currentAlbumPhotos.length}`;
    
    const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
    modalFavoriteBtn.textContent = photo.isFavorite ? '❤️' : '🤍';
    modalFavoriteBtn.title = photo.isFavorite ? 'Remove from favorites' : 'Add to favorites';
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    prevBtn.disabled = currentModalIndex === 0;
    nextBtn.disabled = currentModalIndex === currentAlbumPhotos.length - 1;
    
    if (currentAlbumPhotos.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    }
}

/**
 * Navigate between images in modal
 */
function navigateImage(direction) {
    const newIndex = currentModalIndex + direction;
    if (newIndex >= 0 && newIndex < currentAlbumPhotos.length) {
        currentModalIndex = newIndex;
        showModalImage();
    }
}

/**
 * Download current photo from modal
 */
function downloadCurrentPhoto() {
    if (currentAlbumPhotos.length === 0) return;
    
    const photo = currentAlbumPhotos[currentModalIndex];
    downloadPhoto(photo.id);
}

/**
 * Toggle favorite for current photo in modal
 */
function toggleCurrentPhotoFavorite() {
    if (currentAlbumPhotos.length === 0) return;
    
    const photo = currentAlbumPhotos[currentModalIndex];
    toggleFavorite(photo.id);
    showModalImage();
}

/**
 * Delete current photo from modal
 */
function deleteCurrentPhoto() {
    if (currentAlbumPhotos.length === 0) return;
    
    const photo = currentAlbumPhotos[currentModalIndex];
    deletePhoto(photo.id);
    closeModal(); // Close modal after deletion
}

// ===========================================
// IMPORT/EXPORT FUNCTIONS
// ===========================================

/**
 * Export all gallery data as JSON
 */
function exportData() {
    const exportData = {
        albums: storageData.albums,
        photos: storageData.photos.map(photo => ({
            ...photo,
            src: photo.src // Keep the Firebase URLs for reference
        })),
        exportDate: new Date().toISOString(),
        version: "2.0",
        cloudSync: true,
        userId: currentUser ? currentUser.uid : null
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `photo-gallery-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
    
    alert('Gallery exported successfully! This backup contains your photo metadata and Firebase URLs.');
}

/**
 * Import gallery data from JSON file (metadata only)
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        showError('Please select a valid JSON file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!importedData.albums || !importedData.photos) {
                throw new Error('Invalid gallery data format');
            }
            
            alert('Note: Import will only restore photo metadata and album structure. The actual photo files remain in Firebase Storage and cannot be transferred between accounts for security reasons.');
            
            const shouldMerge = confirm(
                'Do you want to merge with existing photos?\n\n' +
                'Click "OK" to merge (keep existing + add imported metadata)\n' +
                'Click "Cancel" to replace (delete existing + import only metadata)'
            );
            
            if (shouldMerge) {
                mergeImportedData(importedData);
            } else {
                // Only import metadata structure, not actual files
                storageData.albums = importedData.albums;
                storageData.photos = []; // Can't import actual photos across Firebase accounts
            }
            
            updateStats();
            updateAlbumSelect();
            updateAlbumTabs();
            displayPhotos();
            
            alert(`Gallery structure imported successfully!\nNote: Photo files remain in their original Firebase Storage locations.`);
            
        } catch (error) {
            console.error('Import error:', error);
            showError('Error importing gallery data. Please check the file format.');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

/**
 * Helper function to merge imported data with existing data
 */
function mergeImportedData(importedData) {
    // Only merge album structure - photos can't be transferred between Firebase accounts
    Object.keys(importedData.albums).forEach(albumName => {
        if (albumName === 'All Photos' || albumName === 'Favorites') return;
        
        if (!storageData.albums[albumName]) {
            storageData.albums[albumName] = [];
        }
    });
}

// ===========================================
// CONNECTION & OFFLINE HANDLING
// ===========================================

/**
 * Set up connection monitoring
 */
function setupConnectionMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial status
    if (navigator.onLine) {
        handleOnline();
    } else {
        handleOffline();
    }

    // Monitor Firestore connection state
    if (db) {
        db.enableNetwork().catch(() => {
            console.log('Firestore offline');
        });
    }
}

/**
 * Handle online status
 */
function handleOnline() {
    showConnectionStatus('Online', 'online');
    // Enable Firestore network
    if (db) {
        db.enableNetwork().catch(() => {
            console.log('Failed to enable Firestore network');
        });
    }
}

/**
 * Handle offline status
 */
function handleOffline() {
    showConnectionStatus('Offline', 'offline');
    updateSyncStatus('Offline', '🔴');
}

/**
 * Show connection status
 */
function showConnectionStatus(status, type) {
    let statusEl = document.getElementById('connectionStatus');
    
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'connectionStatus';
        statusEl.className = 'connection-status';
        document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = status;
    statusEl.className = `connection-status ${type}`;
    
    // Auto-hide after 3 seconds if online
    if (type === 'online') {
        setTimeout(() => {
            if (statusEl && statusEl.classList.contains('online')) {
                statusEl.style.display = 'none';
            }
        }, 3000);
    } else {
        statusEl.style.display = 'block';
    }
}

// ===========================================
// EVENT LISTENERS & SETUP
// ===========================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Authentication buttons
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (signInBtn) {
        signInBtn.addEventListener('click', signInWithGoogle);
        console.log('✅ Sign-in button listener added');
    } else {
        console.error('❌ Sign-in button not found');
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
        console.log('✅ Sign-out button listener added');
    }
    
    // Modal event listeners
    document.addEventListener('click', function(event) {
        const modal = document.getElementById('imageModal');
        if (event.target === modal) {
            closeModal();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(event) {
        const modal = document.getElementById('imageModal');
        if (modal && modal.style.display === 'block') {
            switch(event.key) {
                case 'Escape':
                    closeModal();
                    break;
                case 'ArrowLeft':
                    navigateImage(-1);
                    break;
                case 'ArrowRight':
                    navigateImage(1);
                    break;
                case 'Delete':
                case 'Backspace':
                    if (event.ctrlKey || event.metaKey) {
                        deleteCurrentPhoto();
                    }
                    break;
                case 'f':
                case 'F':
                    toggleCurrentPhotoFavorite();
                    break;
                case 'd':
                case 'D':
                    downloadCurrentPhoto();
                    break;
            }
        }
    });

    // File input change handler for photos
    const photoUpload = document.getElementById('photoUpload');
    if (photoUpload) {
        photoUpload.addEventListener('change', function(event) {
            const files = event.target.files;
            if (files.length > 0) {
                const uploadBtn = document.getElementById('uploadBtn');
                if (uploadBtn) {
                    uploadBtn.textContent = `Upload ${files.length} Photo${files.length > 1 ? 's' : ''}`;
                }
            }
        });
    }

    // Auto-save album name on Enter key
    const albumNameInput = document.getElementById('albumName');
    if (albumNameInput) {
        albumNameInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                createAlbum();
            }
        });
    }
    
    console.log('✅ All event listeners set up');
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Set loading state for buttons
 */
function setButtonLoading(buttonId, loading, originalText = '') {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = loading;
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.textContent = button.dataset.originalText || originalText;
        }
    }
}

// ===========================================
// ERROR HANDLING
// ===========================================

/**
 * Global error handler
 */
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    updateSyncStatus('Error occurred', '❌');
});

/**
 * Handle Promise rejections
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    updateSyncStatus('Sync error', '❌');
    // Prevent the default behavior of logging to console
    event.preventDefault();
});

// ===========================================
// GLOBAL FUNCTION EXPORTS
// ===========================================

// Export functions for global access (for HTML onclick handlers)
window.createAlbum = createAlbum;
window.uploadPhotos = uploadPhotos;
window.deletePhoto = deletePhoto;
window.deleteAlbum = deleteAlbum;
window.showAlbum = showAlbum;
window.showAllPhotos = showAllPhotos;
window.toggleFavorite = toggleFavorite;
window.downloadPhoto = downloadPhoto;
window.openModal = openModal;
window.closeModal = closeModal;
window.navigateImage = navigateImage;
window.downloadCurrentPhoto = downloadCurrentPhoto;
window.toggleCurrentPhotoFavorite = toggleCurrentPhotoFavorite;
window.deleteCurrentPhoto = deleteCurrentPhoto;
window.exportData = exportData;
window.importData = importData;
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
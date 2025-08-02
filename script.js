// ===========================================
// GLOBAL VARIABLES & STATE MANAGEMENT
// ===========================================

// Central data storage object
let storageData = {
    albums: {},
    photos: []
};

// UI state variables
let currentAlbum = '';
let currentModalIndex = 0;
let currentAlbumPhotos = [];

// ===========================================
// STORAGE FUNCTIONS
// ===========================================

/**
 * Load data from localStorage and initialize default structure
 */
function loadFromStorage() {
    try {
        const savedAlbums = localStorage.getItem('photoGalleryAlbums');
        const savedPhotos = localStorage.getItem('photoGalleryPhotos');
        
        if (savedAlbums && savedPhotos) {
            storageData.albums = JSON.parse(savedAlbums);
            storageData.photos = JSON.parse(savedPhotos);
        } else {
            // Initialize default structure
            storageData.albums = { 'All Photos': [], 'Favorites': [] };
            storageData.photos = [];
        }
    } catch (error) {
        console.error('Error loading from storage:', error);
        storageData.albums = { 'All Photos': [], 'Favorites': [] };
        storageData.photos = [];
    }
}

/**
 * Save current data to localStorage
 */
function saveToStorage() {
    try {
        localStorage.setItem('photoGalleryAlbums', JSON.stringify(storageData.albums));
        localStorage.setItem('photoGalleryPhotos', JSON.stringify(storageData.photos));
    } catch (error) {
        console.error('Error saving to storage:', error);
    }
}

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

// ===========================================
// UI UPDATE FUNCTIONS
// ===========================================

/**
 * Update the statistics display
 */
function updateStats() {
    document.getElementById('totalPhotos').textContent = storageData.photos.length;
    document.getElementById('totalAlbums').textContent = Object.keys(storageData.albums).length - 1;
}

/**
 * Update the album selection dropdown
 */
function updateAlbumSelect() {
    const select = document.getElementById('albumSelect');
    select.innerHTML = '<option value="">Select an album...</option>';
    
    Object.keys(storageData.albums).forEach(albumName => {
        if (albumName !== 'All Photos') {
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
    const photosToShow = currentAlbum ? storageData.albums[currentAlbum] : storageData.photos;
    
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
        <div class="photo-card">
            <img src="${photo.src}" alt="${photo.name}" onclick="openModal(${index})" style="cursor: pointer;">
            <div class="photo-actions">
                <button class="action-btn favorite-btn ${storageData.albums['Favorites'].some(p => p.id === photo.id) ? 'favorited' : ''}" 
                        onclick="event.stopPropagation(); toggleFavorite(${photo.id})" 
                        title="${storageData.albums['Favorites'].some(p => p.id === photo.id) ? 'Remove from favorites' : 'Add to favorites'}">
                    ${storageData.albums['Favorites'].some(p => p.id === photo.id) ? '❤️' : '🤍'}
                </button>
                <button class="action-btn download-btn" onclick="event.stopPropagation(); downloadPhoto(${photo.id})" title="Download photo">📥</button>
                <button class="action-btn delete-btn" onclick="event.stopPropagation(); deletePhoto(${photo.id})" title="Delete photo">×</button>
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
 * Create a new album
 */
function createAlbum() {
    const albumName = document.getElementById('albumName').value.trim();
    if (!albumName) {
        alert('Please enter an album name');
        return;
    }
    if (storageData.albums[albumName]) {
        alert('Album already exists');
        return;
    }

    storageData.albums[albumName] = [];
    saveToStorage();
    updateAlbumSelect();
    updateAlbumTabs();
    updateStats();
    document.getElementById('albumName').value = '';
}

/**
 * Delete an album
 */
function deleteAlbum(albumName) {
    if (albumName === 'All Photos' || albumName === 'Favorites') {
        alert('Cannot delete system albums');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the album "${albumName}"?\n\nThis will NOT delete the photos, they will remain in other albums.`)) {
        return;
    }
    
    delete storageData.albums[albumName];
    
    if (currentAlbum === albumName) {
        currentAlbum = 'All Photos';
    }
    
    saveToStorage();
    updateAlbumSelect();
    updateAlbumTabs();
    updateStats();
    displayPhotos();
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
 * Upload photos to selected album
 */
function uploadPhotos() {
    const fileInput = document.getElementById('photoUpload');
    const selectedAlbum = document.getElementById('albumSelect').value;
    
    if (!selectedAlbum) {
        alert('Please select an album first');
        return;
    }
    
    if (!fileInput.files.length) {
        alert('Please select photos to upload');
        return;
    }

    let processedFiles = 0;
    const totalFiles = fileInput.files.length;

    Array.from(fileInput.files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photo = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    src: e.target.result,
                    album: selectedAlbum
                };
                
                storageData.photos.push(photo);
                storageData.albums[selectedAlbum].push(photo);
                storageData.albums['All Photos'].push(photo);
                
                processedFiles++;
                if (processedFiles === totalFiles) {
                    saveToStorage();
                    updateStats();
                    updateAlbumTabs();
                    if (currentAlbum === selectedAlbum || currentAlbum === 'All Photos') {
                        displayPhotos();
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    });

    fileInput.value = '';
}

/**
 * Delete a photo
 */
function deletePhoto(photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    // Find and remove photo from photos array
    const photoIndex = storageData.photos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) return;
    
    const photo = storageData.photos[photoIndex];
    storageData.photos.splice(photoIndex, 1);
    
    // Remove from all relevant albums
    Object.keys(storageData.albums).forEach(albumName => {
        const albumPhotoIndex = storageData.albums[albumName].findIndex(p => p.id === photoId);
        if (albumPhotoIndex !== -1) {
            storageData.albums[albumName].splice(albumPhotoIndex, 1);
        }
    });
    
    saveToStorage();
    updateStats();
    updateAlbumTabs();
    displayPhotos();
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
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Toggle favorite status of a photo
 */
function toggleFavorite(photoId) {
    const photo = storageData.photos.find(p => p.id === photoId);
    if (!photo) return;
    
    const favoriteIndex = storageData.albums['Favorites'].findIndex(p => p.id === photoId);
    
    if (favoriteIndex === -1) {
        storageData.albums['Favorites'].push(photo);
        alert('Photo added to favorites!');
    } else {
        storageData.albums['Favorites'].splice(favoriteIndex, 1);
        alert('Photo removed from favorites!');
    }
    
    saveToStorage();
    updateAlbumTabs();
    displayPhotos();
}

// ===========================================
// MODAL FUNCTIONS
// ===========================================

/**
 * Open modal with photo at specified index
 */
function openModal(index) {
    currentAlbumPhotos = currentAlbum ? storageData.albums[currentAlbum] : storageData.photos;
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
    document.getElementById('modalImage').src = photo.src;
    document.getElementById('modalPhotoName').textContent = photo.name;
    document.getElementById('modalPhotoDetails').textContent = 
        `Album: ${photo.album} • ${currentModalIndex + 1} of ${currentAlbumPhotos.length}`;
    
    const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
    const isFavorited = storageData.albums['Favorites'].some(p => p.id === photo.id);
    modalFavoriteBtn.textContent = isFavorited ? '❤️' : '🤍';
    modalFavoriteBtn.title = isFavorited ? 'Remove from favorites' : 'Add to favorites';
    
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
    const link = document.createElement('a');
    link.href = photo.src;
    link.download = photo.name;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

// ===========================================
// IMPORT/EXPORT FUNCTIONS
// ===========================================

/**
 * Export all gallery data as JSON
 */
function exportData() {
    const exportData = {
        albums: storageData.albums,
        photos: storageData.photos,
        exportDate: new Date().toISOString(),
        version: "1.0"
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
    
    alert('Gallery exported successfully! You can import this file on any browser.');
}

/**
 * Import gallery data from JSON file
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        alert('Please select a valid JSON file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!importedData.albums || !importedData.photos) {
                throw new Error('Invalid gallery data format');
            }
            
            const shouldMerge = confirm(
                'Do you want to merge with existing photos?\n\n' +
                'Click "OK" to merge (keep existing + add imported)\n' +
                'Click "Cancel" to replace (delete existing + import only)'
            );
            
            if (shouldMerge) {
                mergeImportedData(importedData);
            } else {
                storageData.albums = importedData.albums;
                storageData.photos = importedData.photos;
            }
            
            if (!storageData.albums['All Photos']) {
                storageData.albums['All Photos'] = [];
            }
            storageData.albums['All Photos'] = [...storageData.photos];
            
            saveToStorage();
            updateStats();
            updateAlbumSelect();
            updateAlbumTabs();
            displayPhotos();
            
            alert(`Gallery imported successfully!\nImported ${importedData.photos.length} photos from ${Object.keys(importedData.albums).length - 1} albums.`);
            
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing gallery data. Please check the file format.');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

/**
 * Helper function to merge imported data with existing data
 */
function mergeImportedData(importedData) {
    const existingPhotoIds = new Set(storageData.photos.map(p => p.id));
    
    importedData.photos.forEach(photo => {
        if (!existingPhotoIds.has(photo.id)) {
            storageData.photos.push(photo);
            storageData.albums['All Photos'].push(photo);
        }
    });
    
    Object.keys(importedData.albums).forEach(albumName => {
        if (albumName === 'All Photos') return;
        
        if (!storageData.albums[albumName]) {
            storageData.albums[albumName] = [];
        }
        
        importedData.albums[albumName].forEach(photo => {
            const photoExists = storageData.albums[albumName].some(p => p.id === photo.id);
            if (!photoExists && !existingPhotoIds.has(photo.id)) {
                storageData.albums[albumName].push(photo);
            }
        });
    });
}

// ===========================================
// EVENT LISTENERS & INITIALIZATION
// ===========================================

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    initializeAlbums();
    updateAlbumSelect();
    updateAlbumTabs();
    showAllPhotos();
    updateStats();
});

/**
 * Close modal when clicking outside the image
 */
document.addEventListener('click', function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        closeModal();
    }
});

/**
 * Keyboard navigation for modal
 */
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
        }
    }
});
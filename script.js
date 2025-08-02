// Global variables
let albums = {};
let photos = [];
let currentAlbum = '';
let currentModalIndex = 0;
let currentAlbumPhotos = [];

// Load data from localStorage on page load
function loadFromStorage() {
    try {
        const savedAlbums = localStorage.getItem('photoGalleryAlbums');
        const savedPhotos = localStorage.getItem('photoGalleryPhotos');
        
        if (savedAlbums) {
            albums = JSON.parse(savedAlbums);
        }
        
        if (savedPhotos) {
            photos = JSON.parse(savedPhotos);
        }
        
        // Ensure 'All Photos' album exists and is populated correctly
        if (!albums['All Photos']) {
            albums['All Photos'] = [];
        }
        
        // Rebuild 'All Photos' from the photos array to ensure consistency
        albums['All Photos'] = [...photos];
        
    } catch (error) {
        console.error('Error loading from storage:', error);
        albums = { 'All Photos': [] };
        photos = [];
    }
}

// Save data to localStorage
function saveToStorage() {
    try {
        localStorage.setItem('photoGalleryAlbums', JSON.stringify(albums));
        localStorage.setItem('photoGalleryPhotos', JSON.stringify(photos));
    } catch (error) {
        console.error('Error saving to storage:', error);
    }
}

// Initialize with default albums if none exist
function initializeAlbums() {
    if (!albums['All Photos']) {
        albums['All Photos'] = [];
    }
    if (!albums['Favorites']) {
        albums['Favorites'] = [];
    }
}

// Update statistics display
function updateStats() {
    document.getElementById('totalPhotos').textContent = photos.length;
    document.getElementById('totalAlbums').textContent = Object.keys(albums).length - 1; // Exclude 'All Photos'
}

// Create a new album
function createAlbum() {
    const albumName = document.getElementById('albumName').value.trim();
    if (!albumName) {
        alert('Please enter an album name');
        return;
    }
    if (albums[albumName]) {
        alert('Album already exists');
        return;
    }

    albums[albumName] = [];
    saveToStorage();
    updateAlbumSelect();
    updateAlbumTabs();
    updateStats();
    document.getElementById('albumName').value = '';
}

// Update the album selection dropdown
function updateAlbumSelect() {
    const select = document.getElementById('albumSelect');
    select.innerHTML = '<option value="">Select an album...</option>';
    
    Object.keys(albums).forEach(albumName => {
        if (albumName !== 'All Photos') {
            const option = document.createElement('option');
            option.value = albumName;
            option.textContent = albumName;
            select.appendChild(option);
        }
    });
}

// Update the album tabs display
function updateAlbumTabs() {
    const tabsContainer = document.getElementById('albumTabs');
    tabsContainer.innerHTML = '';

    Object.keys(albums).forEach(albumName => {
        const tab = document.createElement('div');
        tab.className = 'album-tab';
        
        // Add delete button for custom albums (not 'All Photos' or 'Favorites')
        if (albumName !== 'All Photos' && albumName !== 'Favorites') {
            tab.innerHTML = `
                <span onclick="showAlbum('${albumName}')">${albumName} (${albums[albumName].length})</span>
                <button class="album-delete-btn" onclick="event.stopPropagation(); deleteAlbum('${albumName}')" title="Delete album">×</button>
            `;
        } else {
            tab.textContent = `${albumName} (${albums[albumName].length})`;
            tab.onclick = () => showAlbum(albumName);
        }
        
        if (albumName === currentAlbum) {
            tab.classList.add('active');
        }
        tabsContainer.appendChild(tab);
    });
}

// Upload photos to selected album
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
                
                photos.push(photo);
                albums[selectedAlbum].push(photo);
                albums['All Photos'].push(photo);
                
                saveToStorage();
                updateStats();
                updateAlbumTabs();
                if (currentAlbum === selectedAlbum || currentAlbum === 'All Photos') {
                    displayPhotos();
                }
            };
            reader.readAsDataURL(file);
        }
    });

    fileInput.value = '';
}

// Show specific album
function showAlbum(albumName) {
    currentAlbum = albumName;
    updateAlbumTabs();
    displayPhotos();
}

// Download photo function
function downloadPhoto(photoId) {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = photo.src;
    link.download = photo.name;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export all gallery data as JSON
function exportData() {
    const exportData = {
        albums: albums,
        photos: photos,
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
    
    // Clean up the blob URL
    URL.revokeObjectURL(link.href);
    
    alert('Gallery exported successfully! You can import this file on any browser.');
}

// Import gallery data from JSON file
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
            
            // Validate the imported data structure
            if (!importedData.albums || !importedData.photos) {
                throw new Error('Invalid gallery data format');
            }
            
            // Ask user if they want to merge or replace
            const shouldMerge = confirm(
                'Do you want to merge with existing photos?\n\n' +
                'Click "OK" to merge (keep existing + add imported)\n' +
                'Click "Cancel" to replace (delete existing + import only)'
            );
            
            if (shouldMerge) {
                // Merge data
                mergeImportedData(importedData);
            } else {
                // Replace data
                albums = importedData.albums;
                photos = importedData.photos;
            }
            
            // Ensure 'All Photos' album exists and is populated
            if (!albums['All Photos']) {
                albums['All Photos'] = [];
            }
            albums['All Photos'] = [...photos];
            
            // Save to localStorage and update UI
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
    event.target.value = ''; // Reset file input
}

// Helper function to merge imported data with existing data
function mergeImportedData(importedData) {
    // Create a map of existing photo IDs to avoid duplicates
    const existingPhotoIds = new Set(photos.map(p => p.id));
    
    // Add new photos that don't already exist
    importedData.photos.forEach(photo => {
        if (!existingPhotoIds.has(photo.id)) {
            photos.push(photo);
            albums['All Photos'].push(photo);
        }
    });
    
    // Merge albums
    Object.keys(importedData.albums).forEach(albumName => {
        if (albumName === 'All Photos') return; // Skip 'All Photos', we handle it separately
        
        if (!albums[albumName]) {
            // Create new album
            albums[albumName] = [];
        }
        
        // Add photos to album if they don't already exist
        importedData.albums[albumName].forEach(photo => {
            const photoExists = albums[albumName].some(p => p.id === photo.id);
            if (!photoExists && !existingPhotoIds.has(photo.id)) {
                albums[albumName].push(photo);
            }
        });
    });
}

// Download current photo from modal
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

// Show all photos
function showAllPhotos() {
    showAlbum('All Photos');
}

// Display photos in the gallery
function displayPhotos() {
    const gallery = document.getElementById('gallery');
    const photosToShow = currentAlbum ? albums[currentAlbum] : photos;
    
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
                <button class="action-btn favorite-btn ${albums['Favorites'].some(p => p.id === photo.id) ? 'favorited' : ''}" 
                        onclick="event.stopPropagation(); toggleFavorite('${photo.id}')" 
                        title="${albums['Favorites'].some(p => p.id === photo.id) ? 'Remove from favorites' : 'Add to favorites'}">
                    ${albums['Favorites'].some(p => p.id === photo.id) ? '❤️' : '🤍'}
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

// Delete a photo
function deletePhoto(photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    // Find and remove photo from photos array
    const photoIndex = photos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) return;
    
    const photo = photos[photoIndex];
    photos.splice(photoIndex, 1);
    
    // Remove from all relevant albums
    Object.keys(albums).forEach(albumName => {
        const albumPhotoIndex = albums[albumName].findIndex(p => p.id === photoId);
        if (albumPhotoIndex !== -1) {
            albums[albumName].splice(albumPhotoIndex, 1);
        }
    });
    
    saveToStorage();
    updateStats();
    updateAlbumTabs();
    displayPhotos();
}

// Delete an album
function deleteAlbum(albumName) {
    if (albumName === 'All Photos' || albumName === 'Favorites') {
        alert('Cannot delete system albums');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the album "${albumName}"?\n\nThis will NOT delete the photos, they will remain in other albums.`)) {
        return;
    }
    
    // Remove the album
    delete albums[albumName];
    
    // If we're currently viewing the deleted album, switch to All Photos
    if (currentAlbum === albumName) {
        currentAlbum = 'All Photos';
    }
    
    saveToStorage();
    updateAlbumSelect();
    updateAlbumTabs();
    updateStats();
    displayPhotos();
}

// Toggle favorite status of a photo
function toggleFavorite(photoId) {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;
    
    const favoriteIndex = albums['Favorites'].findIndex(p => p.id === photoId);
    
    if (favoriteIndex === -1) {
        // Add to favorites
        albums['Favorites'].push(photo);
        alert('Photo added to favorites!');
    } else {
        // Remove from favorites
        albums['Favorites'].splice(favoriteIndex, 1);
        alert('Photo removed from favorites!');
    }
    
    saveToStorage();
    updateAlbumTabs();
    displayPhotos();
}

// Modal functions
function openModal(index) {
    currentAlbumPhotos = currentAlbum ? albums[currentAlbum] : photos;
    currentModalIndex = index;
    showModalImage();
    document.getElementById('imageModal').style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
}

function showModalImage() {
    if (currentAlbumPhotos.length === 0) return;
    
    const photo = currentAlbumPhotos[currentModalIndex];
    document.getElementById('modalImage').src = photo.src;
    document.getElementById('modalPhotoName').textContent = photo.name;
    document.getElementById('modalPhotoDetails').textContent = 
        `Album: ${photo.album} • ${currentModalIndex + 1} of ${currentAlbumPhotos.length}`;
    
    // Update favorite button in modal
    const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
    const isFavorited = albums['Favorites'].some(p => p.id === photo.id);
    modalFavoriteBtn.textContent = isFavorited ? '❤️' : '🤍';
    modalFavoriteBtn.title = isFavorited ? 'Remove from favorites' : 'Add to favorites';
    
    // Update navigation buttons
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

// Toggle favorite for current photo in modal
function toggleCurrentPhotoFavorite() {
    if (currentAlbumPhotos.length === 0) return;
    
    const photo = currentAlbumPhotos[currentModalIndex];
    toggleFavorite(photo.id);
    
    // Update the modal favorite button
    showModalImage();
}

function navigateImage(direction) {
    const newIndex = currentModalIndex + direction;
    if (newIndex >= 0 && newIndex < currentAlbumPhotos.length) {
        currentModalIndex = newIndex;
        showModalImage();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load data and initialize
    loadFromStorage();
    initializeAlbums();
    updateAlbumSelect();
    updateAlbumTabs();
    showAllPhotos();
    updateStats();
});

// Close modal when clicking outside the image
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
        }
    }
});
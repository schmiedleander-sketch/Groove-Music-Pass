const ipcRenderer = (typeof window !== 'undefined' && window.require) ? window.require('electron').ipcRenderer : {
  invoke: async () => [],
  on: () => {}
};

// Default initial library with nostalgic Groove Pass & classic tracks
const DEFAULT_SONGS = [
  { id: '1', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', duration: '3:53', source: 'demo' },
  { id: '2', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: '3:20', source: 'demo' },
  { id: '3', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special', duration: '4:30', source: 'demo' },
  { id: '4', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', album: 'Vida', duration: '3:48', source: 'demo' },
  { id: '5', title: 'Something Just Like This', artist: 'The Chainsmokers & Coldplay', album: 'Memories...Do Not Open', duration: '4:07', source: 'demo' },
  { id: '6', title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', duration: '4:03', source: 'demo' },
  { id: '7', title: 'Get Lucky', artist: 'Daft Punk ft. Pharrell Williams', album: 'Random Access Memories', duration: '4:08', source: 'demo' },
  { id: '8', title: 'Closer', artist: 'The Chainsmokers ft. Halsey', album: 'Collage', duration: '4:04', source: 'demo' },
  { id: '9', title: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions', duration: '3:06', source: 'demo' },
  { id: '10', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', album: 'Starboy', duration: '3:50', source: 'demo' }
];

const DEFAULT_PLAYLISTS = [
  {
    id: 'pl-1',
    name: 'Groove Music Pass: Top Hits 2017',
    description: 'The definitive 2017 chart toppers from Microsoft Groove Pass.',
    songs: ['1', '2', '3', '5', '8']
  },
  {
    id: 'pl-2',
    name: 'Synthwave & Electronic Vibe',
    description: 'Atmospheric electronic tracks for driving and focus.',
    songs: ['2', '6', '7', '10']
  },
  {
    id: 'pl-3',
    name: 'Acoustic & Chill Lounge',
    description: 'Relaxing pop and chill songs.',
    songs: ['1', '4', '9']
  }
];

// Application State
let songs = JSON.parse(localStorage.getItem('groove_songs')) || DEFAULT_SONGS;
let playlists = JSON.parse(localStorage.getItem('groove_playlists')) || DEFAULT_PLAYLISTS;
let currentPlaylistId = null;
let currentPlayingTrackIndex = -1;
let currentQueue = [];
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;

// DOM Elements
const audioElement = document.getElementById('audio-element');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');

// Save State Helper
function saveState() {
  localStorage.setItem('groove_songs', JSON.stringify(songs));
  localStorage.setItem('groove_playlists', JSON.stringify(playlists));
}

// Navigation & Views
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.content-view');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (!targetView) return;

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      views.forEach(v => v.classList.add('hidden'));
      const activeView = document.getElementById(`view-${targetView}`);
      if (activeView) {
        activeView.classList.remove('hidden');
      }

      if (targetView === 'playlists') {
        renderPlaylistsGrid();
      } else if (targetView === 'spotify-migration') {
        populateMigrationDropdown();
      }
    });
  });

  // Search input filter
  document.getElementById('search-input').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    renderSongsTable(songs.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.artist.toLowerCase().includes(query) ||
      s.album.toLowerCase().includes(query)
    ));
  });

  // Import local music
  document.getElementById('btn-add-music').addEventListener('click', async () => {
    const newFiles = await ipcRenderer.invoke('select-audio-files');
    if (newFiles && newFiles.length > 0) {
      newFiles.forEach(file => {
        const id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        songs.push({ id, ...file });
      });
      saveState();
      renderSongsTable(songs);
      alert(`Successfully added ${newFiles.length} song(s) to your library!`);
    }
  });

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeText = document.getElementById('theme-status-text');
  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeText.textContent = isLight ? 'Light Mode' : 'Dark Mode';
    themeBtn.querySelector('i').className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
}

// Songs View Table Render
function renderSongsTable(songsList) {
  const tbody = document.getElementById('songs-table-body');
  document.getElementById('songs-count-stats').textContent = `${songsList.length} songs`;
  tbody.innerHTML = '';

  songsList.forEach((song, idx) => {
    const tr = document.createElement('tr');
    if (currentQueue[currentPlayingTrackIndex] && currentQueue[currentPlayingTrackIndex].id === song.id) {
      tr.classList.add('playing');
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <button class="play-row-btn" data-id="${song.id}">
          <i class="fa-solid fa-play"></i>
        </button>
      </td>
      <td style="font-weight: 600;">${song.title}</td>
      <td style="color: var(--text-muted);">${song.artist}</td>
      <td style="color: var(--text-muted);">${song.album}</td>
      <td style="color: var(--text-dim);">${song.duration}</td>
      <td>
        <button class="btn-icon add-to-pl-btn" data-id="${song.id}" title="Add to Playlist">
          <i class="fa-solid fa-plus"></i>
        </button>
      </td>
    `;

    tr.querySelector('.play-row-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playSongFromList(songsList, idx);
    });

    tr.querySelector('.add-to-pl-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      promptAddToPlaylist(song.id);
    });

    tr.addEventListener('dblclick', () => {
      playSongFromList(songsList, idx);
    });

    tbody.appendChild(tr);
  });
}

// Playlists Render
function renderPlaylistsGrid() {
  const grid = document.getElementById('playlists-grid');
  grid.innerHTML = '';

  playlists.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-art"><i class="fa-solid fa-music"></i></div>
      <h3>${pl.name}</h3>
      <p>${pl.songs.length} songs</p>
    `;

    card.addEventListener('click', () => {
      openPlaylistDetail(pl.id);
    });

    grid.appendChild(card);
  });
}

function openPlaylistDetail(playlistId) {
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return;

  currentPlaylistId = pl.id;

  // Hide all views, show detail view
  document.querySelectorAll('.content-view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-playlist-detail').classList.remove('hidden');

  document.getElementById('detail-playlist-title').textContent = pl.name;
  document.getElementById('detail-playlist-meta').textContent = `${pl.songs.length} songs • Groove Pass Collection`;

  const plSongs = songs.filter(s => pl.songs.includes(s.id));
  const tbody = document.getElementById('playlist-songs-table-body');
  tbody.innerHTML = '';

  plSongs.forEach((song, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <button class="play-row-btn" data-id="${song.id}">
          <i class="fa-solid fa-play"></i>
        </button>
      </td>
      <td style="font-weight: 600;">${song.title}</td>
      <td style="color: var(--text-muted);">${song.artist}</td>
      <td style="color: var(--text-muted);">${song.album}</td>
      <td style="color: var(--text-dim);">${song.duration}</td>
      <td>
        <button class="btn-icon remove-from-pl-btn" data-id="${song.id}" title="Remove from Playlist">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </td>
    `;

    tr.querySelector('.play-row-btn').addEventListener('click', () => {
      playSongFromList(plSongs, idx);
    });

    tr.querySelector('.remove-from-pl-btn').addEventListener('click', () => {
      pl.songs = pl.songs.filter(id => id !== song.id);
      saveState();
      openPlaylistDetail(playlistId);
    });

    tbody.appendChild(tr);
  });

  // Action buttons inside detail view
  document.getElementById('btn-play-playlist').onclick = () => {
    if (plSongs.length > 0) playSongFromList(plSongs, 0);
  };

  document.getElementById('btn-export-to-spotify').onclick = () => {
    // Switch to Spotify migration view and select this playlist
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-view="spotify-migration"]').classList.add('active');
    document.querySelectorAll('.content-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-spotify-migration').classList.remove('hidden');
    populateMigrationDropdown();
    document.getElementById('migration-playlist-select').value = playlistId;
  };

  document.getElementById('btn-delete-playlist').onclick = () => {
    if (confirm(`Are you sure you want to delete "${pl.name}"?`)) {
      playlists = playlists.filter(p => p.id !== playlistId);
      saveState();
      document.querySelector('[data-view="playlists"]').click();
    }
  };
}

// Audio Player Functions
function playSongFromList(queue, index) {
  currentQueue = queue;
  currentPlayingTrackIndex = index;
  const song = currentQueue[currentPlayingTrackIndex];

  if (!song) return;

  playerTitle.textContent = song.title;
  playerArtist.textContent = `${song.artist} • ${song.album}`;

  if (song.source === 'local') {
    audioElement.src = `file://${song.path}`;
  } else {
    // Demo audio sample
    audioElement.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  }

  audioElement.play().then(() => {
    isPlaying = true;
    updatePlayPauseUI();
  }).catch(() => {
    isPlaying = true;
    updatePlayPauseUI();
  });

  renderSongsTable(songs);
}

function updatePlayPauseUI() {
  btnPlayPause.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}

function setupAudioPlayerControls() {
  btnPlayPause.addEventListener('click', () => {
    if (currentPlayingTrackIndex === -1 && songs.length > 0) {
      playSongFromList(songs, 0);
      return;
    }
    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
    } else {
      audioElement.play().catch(() => {});
      isPlaying = true;
    }
    updatePlayPauseUI();
  });

  btnPrev.addEventListener('click', () => {
    if (currentQueue.length === 0) return;
    let prevIndex = currentPlayingTrackIndex - 1;
    if (prevIndex < 0) prevIndex = currentQueue.length - 1;
    playSongFromList(currentQueue, prevIndex);
  });

  btnNext.addEventListener('click', () => {
    if (currentQueue.length === 0) return;
    let nextIndex = currentPlayingTrackIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * currentQueue.length);
    }
    if (nextIndex >= currentQueue.length) nextIndex = 0;
    playSongFromList(currentQueue, nextIndex);
  });

  btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    btnShuffle.classList.toggle('active', isShuffle);
  });

  btnRepeat.addEventListener('click', () => {
    isRepeat = !isRepeat;
    btnRepeat.classList.toggle('active', isRepeat);
  });

  audioElement.addEventListener('timeupdate', () => {
    if (audioElement.duration) {
      const current = audioElement.currentTime;
      const total = audioElement.duration;
      seekSlider.value = (current / total) * 100;
      timeCurrent.textContent = formatTime(current);
      timeTotal.textContent = formatTime(total);
    }
  });

  audioElement.addEventListener('ended', () => {
    if (isRepeat) {
      audioElement.currentTime = 0;
      audioElement.play();
    } else {
      btnNext.click();
    }
  });

  seekSlider.addEventListener('input', () => {
    if (audioElement.duration) {
      audioElement.currentTime = (seekSlider.value / 100) * audioElement.duration;
    }
  });

  volumeSlider.addEventListener('input', () => {
    audioElement.volume = volumeSlider.value / 100;
  });
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// Spotify Migration Tool
function populateMigrationDropdown() {
  const select = document.getElementById('migration-playlist-select');
  select.innerHTML = '<option value="all">All Songs in My Groove Library</option>';

  playlists.forEach(pl => {
    const opt = document.createElement('option');
    opt.value = pl.id;
    opt.textContent = `Playlist: ${pl.name} (${pl.songs.length} tracks)`;
    select.appendChild(opt);
  });
}

function setupSpotifyMigration() {
  const btnStart = document.getElementById('btn-start-migration');
  const resultsBox = document.getElementById('migration-results');

  btnStart.addEventListener('click', () => {
    const selectedVal = document.getElementById('migration-playlist-select').value;
    let exportSongs = [];
    let name = '';

    if (selectedVal === 'all') {
      exportSongs = songs;
      name = 'Groove Music Pass Library';
    } else {
      const pl = playlists.find(p => p.id === selectedVal);
      if (pl) {
        exportSongs = songs.filter(s => pl.songs.includes(s.id));
        name = pl.name;
      }
    }

    document.getElementById('migrated-playlist-name').textContent = name;
    document.getElementById('migrated-playlist-stats').textContent = `${exportSongs.length} tracks ready for Spotify transfer.`;
    resultsBox.classList.remove('hidden');

    // Attach Download CSV Action
    document.getElementById('btn-download-csv').onclick = async () => {
      let csvContent = 'Track Title,Artist,Album,Duration\n';
      exportSongs.forEach(s => {
        csvContent += `"${s.title}","${s.artist}","${s.album}","${s.duration}"\n`;
      });

      await ipcRenderer.invoke('save-playlist-file', {
        name: name.replace(/[^a-zA-Z0-9_-]/g, '_'),
        content: csvContent,
        extension: 'csv'
      });
    };

    // Attach Copy Spotify Search Links
    document.getElementById('btn-copy-spotify-links').onclick = () => {
      const links = exportSongs.map(s =>
        `https://open.spotify.com/search/${encodeURIComponent(s.title + ' ' + s.artist)}`
      ).join('\n');

      if (navigator.clipboard) {
        navigator.clipboard.writeText(links);
      }
      alert('Spotify search links copied to clipboard!');
    };

    // Open Spotify Web
    document.getElementById('btn-open-spotify-web').onclick = () => {
      ipcRenderer.invoke('open-external-url', 'https://open.spotify.com');
    };
  });
}

// Modals Setup
function setupPlaylistModal() {
  const modal = document.getElementById('modal-new-playlist');
  const btnNew = document.getElementById('btn-new-playlist');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const btnConfirm = document.getElementById('btn-confirm-create-playlist');
  const inputName = document.getElementById('new-playlist-name-input');

  btnNew.addEventListener('click', () => {
    inputName.value = '';
    modal.classList.remove('hidden');
  });

  const closeModal = () => modal.classList.add('hidden');
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  btnConfirm.addEventListener('click', () => {
    const val = inputName.value.trim();
    if (!val) return;

    const newPl = {
      id: 'pl-' + Date.now(),
      name: val,
      description: 'Custom Groove Playlist',
      songs: []
    };

    playlists.push(newPl);
    saveState();
    renderUserPlaylistsNav();
    closeModal();
  });
}

function renderUserPlaylistsNav() {
  const container = document.getElementById('user-playlists-nav');
  container.innerHTML = '';

  playlists.forEach(pl => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.innerHTML = `<i class="fa-solid fa-list"></i><span>${pl.name}</span>`;
    btn.addEventListener('click', () => {
      openPlaylistDetail(pl.id);
    });
    container.appendChild(btn);
  });
}

function promptAddToPlaylist(songId) {
  if (playlists.length === 0) {
    alert('Please create a playlist first!');
    return;
  }

  const plNames = playlists.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const choice = prompt(`Select a playlist to add this song:\n${plNames}\n\nEnter playlist number:`);
  const idx = parseInt(choice) - 1;

  if (!isNaN(idx) && playlists[idx]) {
    if (!playlists[idx].songs.includes(songId)) {
      playlists[idx].songs.push(songId);
      saveState();
      alert(`Added track to "${playlists[idx].name}"`);
    } else {
      alert('Track is already in this playlist.');
    }
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  renderSongsTable(songs);
  renderUserPlaylistsNav();
  setupAudioPlayerControls();
  setupSpotifyMigration();
  setupPlaylistModal();
});

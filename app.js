const API_URL = 'https://supersoul.site/api/nowplaying/SRRS320kbps';
const STREAM_URL = 'https://supersoul.site:8000/OSS-320';
const audioPlayer = document.getElementById('audioPlayer');
const albumArt = document.getElementById('albumArt');
const titleElement = document.getElementById('title');
const artistElement = document.getElementById('artist');
const playButton = document.getElementById('playButton');
const playButtonIcon = playButton.querySelector('.material-icons');
const canvas = document.getElementById('spectrogram');
const ctx = canvas.getContext('2d');

let currentSongId = null;
let isPlaying = false;
let audioContext = null;
let analyser = null;
let animationId = null;

// Set up canvas for high DPI displays
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    return rect;
}

// Initialize Web Audio API
async function initializeAudio() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created:', audioContext.state);

            // Create and configure analyzer
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512; // Smaller for better performance and visualization
            analyser.minDecibels = -85;
            analyser.maxDecibels = -10;
            analyser.smoothingTimeConstant = 0.85;

            // Create media source and connect nodes
            const source = audioContext.createMediaElementSource(audioPlayer);
            console.log('Media source created');
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            console.log('Audio nodes connected');
        }

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('AudioContext resumed');
        }
    } catch (error) {
        console.error('Error initializing audio:', error);
    }
}

// Draw spectrogram
function drawSpectrogram() {
    if (!isPlaying) return;

    const rect = canvas.getBoundingClientRect();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Clear the canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const barWidth = rect.width / (analyser.frequencyBinCount / 2); // Only show useful frequency range
    const barCount = analyser.frequencyBinCount / 2;

    // Draw frequency bars
    for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * dataArray.length / barCount);
        const value = dataArray[dataIndex];
        const percent = value / 255;
        const height = rect.height * percent;
        const x = i * barWidth;
        const hue = 250 - (percent * 100); // Purple to pink gradient

        ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.9)`;
        ctx.fillRect(x, rect.height - height, barWidth - 1, height);
    }

    animationId = requestAnimationFrame(drawSpectrogram);
}

// Initialize audio stream
function initializeAudioStream() {
    if (!audioPlayer.src) {
        audioPlayer.crossOrigin = "anonymous";
        audioPlayer.src = STREAM_URL;
        audioPlayer.load();
    }
}

// Set crossOrigin immediately for initial setup
audioPlayer.crossOrigin = "anonymous";

// Toggle play/pause
async function togglePlayPause() {
    try {
        if (isPlaying) {
            audioPlayer.pause();
            isPlaying = false;
            playButtonIcon.textContent = 'play_circle_filled';
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        } else {
            // Initialize audio context first
            await initializeAudio();
            console.log('Audio context initialized');

            // Then initialize and play stream
            initializeAudioStream();
            console.log('Stream initialized, URL:', audioPlayer.src);

            try {
                await audioPlayer.play();
                console.log('Playback started successfully');
                isPlaying = true;
                playButtonIcon.textContent = 'pause_circle_filled';
                setupCanvas();
                drawSpectrogram();
            } catch (playError) {
                console.error('Play error:', playError);
                throw playError;
            }
        }
    } catch (error) {
        console.error('Playback failed:', error);
        playButtonIcon.textContent = 'error';
        setTimeout(() => {
            playButtonIcon.textContent = 'play_circle_filled';
        }, 2000);
    }
}

async function updateMetadata() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const nowPlaying = data[0].now_playing;

        // Only update if it's a different song
        if (currentSongId !== nowPlaying.song.id) {
            currentSongId = nowPlaying.song.id;

            // Update album art with fade effect
            const newImage = new Image();
            newImage.onload = () => {
                albumArt.style.opacity = '0';
                setTimeout(() => {
                    albumArt.src = nowPlaying.song.art;
                    albumArt.style.opacity = '1';
                }, 300);
            };
            newImage.src = nowPlaying.song.art;

            // Update text with fade effect
            titleElement.style.opacity = '0';
            artistElement.style.opacity = '0';

            setTimeout(() => {
                titleElement.textContent = nowPlaying.song.title;
                artistElement.textContent = nowPlaying.song.artist;

                titleElement.style.opacity = '1';
                artistElement.style.opacity = '1';
            }, 300);
        }
    } catch (error) {
        console.error('Error fetching metadata:', error);
    }
}

// Initialize on first user interaction
playButton.addEventListener('click', () => {
    togglePlayPause().catch(console.error);
});

// Handle window resize
window.addEventListener('resize', () => {
    if (isPlaying) {
        setupCanvas();
    }
});

// Handle audio player errors
audioPlayer.onerror = (e) => {
    console.error('Audio player error:', e);
    playButtonIcon.textContent = 'error';
    isPlaying = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    setTimeout(() => {
        playButtonIcon.textContent = 'play_circle_filled';
        audioPlayer.load(); // Attempt to reload the stream
    }, 2000);
};

// Monitor audio player state changes
audioPlayer.addEventListener('play', () => console.log('Audio player play event'));
audioPlayer.addEventListener('playing', () => console.log('Audio player playing event'));
audioPlayer.addEventListener('pause', () => console.log('Audio player pause event'));
audioPlayer.addEventListener('waiting', () => console.log('Audio player waiting for data'));
audioPlayer.addEventListener('stalled', () => console.log('Audio player stalled'));
audioPlayer.addEventListener('canplay', () => console.log('Audio player can play'));
audioPlayer.addEventListener('loadstart', () => console.log('Audio player load started'));

// Initial setup
updateMetadata();
setInterval(updateMetadata, 10000);

// Add smooth fade transitions
albumArt.style.transition = 'opacity 0.3s ease';
titleElement.style.transition = 'opacity 0.3s ease';
artistElement.style.transition = 'opacity 0.3s ease';

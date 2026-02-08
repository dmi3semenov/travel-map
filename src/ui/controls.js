import { store } from '../state/store.js';

export function initControls(engine) {
  const btnPlay = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnSpeedSettings = document.getElementById('btn-speed-settings');
  const speedPanel = document.getElementById('speed-panel');

  function updateUI() {
    const state = store.getAnimationState();
    const hasRoute = store.getWaypoints().length >= 2;

    if (state === 'playing') {
      btnPlay.classList.add('hidden');
      btnPause.classList.remove('hidden');
    } else {
      btnPlay.classList.remove('hidden');
      btnPause.classList.add('hidden');
    }

    btnPlay.disabled = !hasRoute;
    btnReset.disabled = state === 'idle';
  }

  btnPlay.addEventListener('click', () => engine.play());
  btnPause.addEventListener('click', () => engine.pause());
  btnReset.addEventListener('click', () => engine.reset());

  // Speed panel toggle
  btnSpeedSettings.addEventListener('click', e => {
    e.stopPropagation();
    speedPanel.classList.toggle('hidden');
  });

  document.addEventListener('click', e => {
    if (!speedPanel.contains(e.target) && e.target !== btnSpeedSettings) {
      speedPanel.classList.add('hidden');
    }
  });

  // Per-transport speed buttons
  document.querySelectorAll('.speed-panel-row').forEach(row => {
    const transport = row.dataset.transport;
    const btns = row.querySelectorAll('.speed-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        store.setSpeedForTransport(transport, parseFloat(btn.dataset.speed));
      });
    });
  });

  // Progress bar scrubber
  const progressBar = document.getElementById('progress-bar');
  let scrubbing = false;

  function seekFromPointer(e) {
    if (store.getWaypoints().length < 2) return;
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    engine.seek(progress);
  }

  progressBar.addEventListener('mousedown', e => {
    scrubbing = true;
    if (store.getAnimationState() === 'playing') engine.pause();
    seekFromPointer(e);
  });
  document.addEventListener('mousemove', e => {
    if (scrubbing) seekFromPointer(e);
  });
  document.addEventListener('mouseup', () => { scrubbing = false; });

  progressBar.addEventListener('touchstart', e => {
    e.preventDefault();
    if (store.getAnimationState() === 'playing') engine.pause();
    seekFromPointer(e);
  }, { passive: false });
  progressBar.addEventListener('touchmove', e => {
    e.preventDefault();
    seekFromPointer(e);
  }, { passive: false });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      const state = store.getAnimationState();
      if (state === 'playing') engine.pause();
      else engine.play();
    }
    if (e.code === 'KeyR') {
      engine.reset();
    }
  });

  // Subscribe to state changes
  store.subscribe('animation:stateChange', updateUI);
  store.subscribe('waypoint:added', updateUI);
  store.subscribe('waypoint:removed', updateUI);
  store.subscribe('cleared', updateUI);

  updateUI();
}

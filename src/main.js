import './style.css';
import { Webcam } from './webcam.js';
import { DrosteRenderer } from './droste-renderer.js';
import { PixelSortRenderer } from './pixelsort-renderer.js';
import { UI } from './ui.js';

const canvas = document.getElementById('canvas');
const message = document.getElementById('message');
const btnCam = document.getElementById('btn-toggle-cam');
const btnAnim = document.getElementById('btn-toggle-anim');
const cameraSelect = document.getElementById('camera-select');

const webcam = new Webcam();

const renderers = {
  droste: new DrosteRenderer(canvas),
  pixelsort: new PixelSortRenderer(canvas),
};

let activeMode = 'droste';
let activeRenderer = renderers.droste;

const ui = new UI(renderers);

let camRunning = false;

// --- Mode switching ---
function setMode(mode) {
  activeMode = mode;
  activeRenderer = renderers[mode];

  // Update tab styles
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  // Show/hide mode-specific control panels
  document.querySelectorAll('.mode-controls').forEach(el => {
    el.style.display = el.dataset.mode === mode ? '' : 'none';
  });

  // Show/hide mode-specific header buttons
  document.querySelectorAll('[data-modes]').forEach(el => {
    const modes = el.dataset.modes.split(',');
    el.style.display = modes.includes(mode) ? '' : 'none';
  });
}

document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

// --- Camera ---
async function populateCameras() {
  const devices = await webcam.getDevices();
  cameraSelect.innerHTML = '';
  if (devices.length === 0) {
    cameraSelect.innerHTML = '<option value="">No cameras found</option>';
    return;
  }
  devices.forEach((device, i) => {
    const opt = document.createElement('option');
    opt.value = device.deviceId;
    opt.textContent = device.label || `Camera ${i + 1}`;
    if (device.deviceId === webcam.currentDeviceId) opt.selected = true;
    cameraSelect.appendChild(opt);
  });
}

cameraSelect.addEventListener('change', async () => {
  if (!camRunning) return;
  try {
    await webcam.switchDevice(cameraSelect.value);
  } catch (err) {
    console.error('Failed to switch camera:', err);
  }
});

// --- Resize ---
function onResize() {
  // Resize all renderers so they're ready when switched to
  renderers.droste.resize();
  renderers.pixelsort.resize();
}
window.addEventListener('resize', onResize);
onResize();

// --- Animation loop ---
function loop(timestamp) {
  if (webcam.ready) {
    activeRenderer.uploadTexture(webcam.element);
  }
  activeRenderer.render(timestamp);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Start/stop webcam ---
async function startCam() {
  try {
    message.classList.add('hidden');
    await webcam.start(cameraSelect.value || undefined);
    camRunning = true;
    btnCam.classList.add('active');
    await populateCameras();
  } catch (err) {
    message.classList.remove('hidden');
    message.classList.add('error');
    message.querySelector('p').innerHTML =
      err.name === 'NotAllowedError'
        ? 'Camera blocked. Click the lock icon in your address bar, set Camera to "Allow", then refresh.'
        : 'Could not access camera: ' + err.message;
  }
}

function stopCam() {
  webcam.stop();
  camRunning = false;
  btnCam.classList.remove('active');
  message.classList.remove('hidden', 'error');
  message.querySelector('p').textContent = 'Click to start webcam';
}

btnCam.addEventListener('click', () => {
  if (camRunning) stopCam();
  else startCam();
});

// --- Animation toggle (Droste-specific) ---
btnAnim.addEventListener('click', () => {
  renderers.droste.animating = !renderers.droste.animating;
  btnAnim.classList.toggle('active', !renderers.droste.animating);
  document.getElementById('anim-icon').innerHTML = renderers.droste.animating
    ? '&#10074;&#10074;'
    : '&#9654;';
});

// --- Grid toggle (Droste-specific) ---
const btnGrid = document.getElementById('btn-toggle-grid');
const toggleGrid = () => {
  renderers.droste.params.showGrid = renderers.droste.params.showGrid ? 0 : 1;
  btnGrid.classList.toggle('active', !!renderers.droste.params.showGrid);
};
btnGrid.addEventListener('click', toggleGrid);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'g' || e.key === 'G') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    toggleGrid();
  }
});

// --- Click message to start ---
message.addEventListener('click', startCam);

// Auto-start webcam
startCam();

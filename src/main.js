import './style.css';
import { Webcam } from './webcam.js';
import { DrosteRenderer } from './droste-renderer.js';
import { UI } from './ui.js';

const canvas = document.getElementById('canvas');
const message = document.getElementById('message');
const btnCam = document.getElementById('btn-toggle-cam');
const btnAnim = document.getElementById('btn-toggle-anim');
const cameraSelect = document.getElementById('camera-select');

const webcam = new Webcam();
const renderer = new DrosteRenderer(canvas);
const ui = new UI(renderer);

let camRunning = false;

// Populate camera selector
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

// Resize canvas to fill viewport
function onResize() {
  renderer.resize();
}
window.addEventListener('resize', onResize);
onResize();

// Animation loop
function loop(timestamp) {
  if (webcam.ready) {
    renderer.uploadTexture(webcam.element);
  }
  renderer.render(timestamp);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Start webcam
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

// Button handlers
btnCam.addEventListener('click', () => {
  if (camRunning) stopCam();
  else startCam();
});

btnAnim.addEventListener('click', () => {
  renderer.animating = !renderer.animating;
  btnAnim.classList.toggle('active', !renderer.animating);
  document.getElementById('anim-icon').innerHTML = renderer.animating
    ? '&#10074;&#10074;'
    : '&#9654;';
});

// Grid toggle
const btnGrid = document.getElementById('btn-toggle-grid');
const toggleGrid = () => {
  renderer.params.showGrid = renderer.params.showGrid ? 0 : 1;
  btnGrid.classList.toggle('active', !!renderer.params.showGrid);
};
btnGrid.addEventListener('click', toggleGrid);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'g' || e.key === 'G') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    toggleGrid();
  }
});

// Click message to start
message.addEventListener('click', startCam);

// Auto-start webcam
startCam();

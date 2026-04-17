export class UI {
  constructor(renderers) {
    this.drosteRenderer = renderers.droste;
    this.pixelsortRenderer = renderers.pixelsort;
    this.controls = document.getElementById('controls');
    this.hideTimeout = null;
    this.pinned = false;

    // Geometry pad range: -3 to 3. X = log(scale), Y = twist turns per zoom.
    this.geoRange = 3;
    this.manuallyHidden = false;

    // Spring physics state
    this.spring = {
      // Current position (what the shader sees)
      x: this.drosteRenderer.params.geometryX,
      y: this.drosteRenderer.params.geometryY,
      // Target position (where the user dragged to)
      targetX: this.drosteRenderer.params.geometryX,
      targetY: this.drosteRenderer.params.geometryY,
      // Velocity
      vx: 0,
      vy: 0,
      // Parameters
      stiffness: 120,
      damping: 12,
      mass: 1.0,
    };

    this._bindZoomSlider();
    this._bindSpringSliders();
    this._initGeometryPad();
    this._startSpringLoop();
    this._bindPixelSortControls();
    this._bindDrag();
    this._bindAutoHide();
    this._bindToggleUI();
  }

  _bindZoomSlider() {
    const input = document.getElementById('zoomSpeed');
    const display = document.getElementById('val-zoom');

    input.addEventListener('input', () => {
      this.drosteRenderer.params.zoomSpeed = parseFloat(input.value);
      display.textContent = parseFloat(input.value).toFixed(2);
    });
  }

  _bindSpringSliders() {
    const bind = (id, param, format) => {
      const input = document.getElementById(id);
      const display = document.getElementById(`val-${id}`);
      input.addEventListener('input', () => {
        this.spring[param] = parseFloat(input.value);
        display.textContent = format(input.value);
      });
    };

    bind('stiffness', 'stiffness', (v) => Math.round(v));
    bind('damping', 'damping', (v) => parseFloat(v).toFixed(1));
    bind('mass', 'mass', (v) => parseFloat(v).toFixed(1));
  }

  _initGeometryPad() {
    const pad = document.getElementById('geometry-pad');
    this._geoPad = pad;
    this._geoPoint = document.getElementById('geometry-point');
    this._geoDisplay = document.getElementById('val-geometry');
    const geoCanvas = document.getElementById('geometry-canvas');
    const ctx = geoCanvas.getContext('2d');

    this._drawGrid(ctx, geoCanvas.width, geoCanvas.height);

    // Set initial point visual position
    this._updatePointVisual();

    // Dragging sets the spring TARGET, not the actual position
    let dragging = false;

    const onMove = (clientX, clientY) => {
      const rect = pad.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

      this.spring.targetX = (x * 2 - 1) * this.geoRange;
      this.spring.targetY = (y * 2 - 1) * this.geoRange;
    };

    pad.addEventListener('mousedown', (e) => {
      dragging = true;
      onMove(e.clientX, e.clientY);
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (dragging) onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
    });

    pad.addEventListener('touchstart', (e) => {
      dragging = true;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (dragging) {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      dragging = false;
    });
  }

  _updatePointVisual() {
    const x = (this.spring.x / this.geoRange + 1) / 2;
    const y = (this.spring.y / this.geoRange + 1) / 2;
    this._geoPoint.style.left = (x * 100) + '%';
    this._geoPoint.style.top = (y * 100) + '%';
    this._geoDisplay.textContent = this.spring.x.toFixed(1) + ', ' + this.spring.y.toFixed(1);
  }

  _startSpringLoop() {
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
      lastTime = now;

      const s = this.spring;
      const k = s.stiffness;
      const c = s.damping;
      const m = s.mass;

      // Spring force: F = -k * displacement - c * velocity
      // Acceleration: a = F / m
      const dx = s.x - s.targetX;
      const dy = s.y - s.targetY;

      const ax = (-k * dx - c * s.vx) / m;
      const ay = (-k * dy - c * s.vy) / m;

      s.vx += ax * dt;
      s.vy += ay * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Update renderer params
      this.drosteRenderer.params.geometryX = s.x;
      this.drosteRenderer.params.geometryY = s.y;

      // Update visual point position
      this._updatePointVisual();

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  _drawGrid(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);

    const steps = 8;
    const cellW = w / steps;
    const cellH = h / steps;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= steps; i++) {
      const x = i * cellW;
      const y = i * cellH;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  _bindPixelSortControls() {
    const params = this.pixelsortRenderer.params;

    const thresholdInput = document.getElementById('threshold');
    const thresholdDisplay = document.getElementById('val-threshold');
    thresholdInput.addEventListener('input', () => {
      params.threshold = parseFloat(thresholdInput.value);
      thresholdDisplay.textContent = parseFloat(thresholdInput.value).toFixed(2);
    });

    const dirSelect = document.getElementById('sort-direction');
    dirSelect.addEventListener('change', () => {
      params.direction = parseFloat(dirSelect.value);
    });

    const intensityInput = document.getElementById('sort-intensity');
    const intensityDisplay = document.getElementById('val-intensity');
    const intensityFromSlider = (v) => Math.max(1, Math.round(Math.pow(v / 100, 3) * 2048));
    params.intensity = intensityFromSlider(parseFloat(intensityInput.value));
    intensityDisplay.textContent = params.intensity;
    intensityInput.addEventListener('input', () => {
      params.intensity = intensityFromSlider(parseFloat(intensityInput.value));
      intensityDisplay.textContent = params.intensity;
    });

    const reverseInput = document.getElementById('sort-reverse');
    reverseInput.addEventListener('change', () => {
      params.reverse = reverseInput.checked ? 1 : 0;
    });
  }

  _bindDrag() {
    const header = this.controls.querySelector('.controls-header');
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    this._positionInitialized = false;
    const setInitialPosition = () => {
      if (this._positionInitialized) return;
      const rect = this.controls.getBoundingClientRect();
      if (rect.width === 0) return;
      this.controls.style.left = ((window.innerWidth - rect.width) / 2) + 'px';
      this.controls.style.top = (window.innerHeight - rect.height - 20) + 'px';
      this._positionInitialized = true;
    };
    this._setInitialPosition = setInitialPosition;
    setInitialPosition();
    requestAnimationFrame(setInitialPosition);

    const clamp = () => {
      const rect = this.controls.getBoundingClientRect();
      const x = Math.max(0, Math.min(window.innerWidth - rect.width, rect.left));
      const y = Math.max(0, Math.min(window.innerHeight - rect.height, rect.top));
      this.controls.style.left = x + 'px';
      this.controls.style.top = y + 'px';
    };

    const onDown = (clientX, clientY) => {
      const rect = this.controls.getBoundingClientRect();
      offsetX = clientX - rect.left;
      offsetY = clientY - rect.top;
      dragging = true;
      header.classList.add('dragging');
    };

    const onMove = (clientX, clientY) => {
      if (!dragging) return;
      this.controls.style.left = (clientX - offsetX) + 'px';
      this.controls.style.top = (clientY - offsetY) + 'px';
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      header.classList.remove('dragging');
      clamp();
    };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      onDown(e.clientX, e.clientY);
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onUp);

    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      const t = e.touches[0];
      onDown(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (dragging) {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', onUp);

    window.addEventListener('resize', clamp);
  }

  _bindAutoHide() {
    const resetHideTimer = () => {
      if (this.pinned || this.manuallyHidden) return;
      this.controls.classList.remove('hidden');
      if (this._setInitialPosition) this._setInitialPosition();
      clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        if (!this.manuallyHidden) {
          this.controls.classList.add('hidden');
        }
      }, 3000);
    };

    document.addEventListener('mousemove', resetHideTimer);
    document.addEventListener('touchstart', resetHideTimer);

    this.controls.addEventListener('mouseenter', () => {
      this.pinned = true;
      clearTimeout(this.hideTimeout);
      if (!this.manuallyHidden) {
        this.controls.classList.remove('hidden');
      }
    });

    this.controls.addEventListener('mouseleave', () => {
      this.pinned = false;
      if (!this.manuallyHidden) resetHideTimer();
    });

    this.hideTimeout = setTimeout(() => {
      if (!this.manuallyHidden) {
        this.controls.classList.add('hidden');
      }
    }, 4000);
  }

  _bindToggleUI() {
    const btn = document.getElementById('btn-toggle-ui');

    const toggle = () => {
      this.manuallyHidden = !this.manuallyHidden;
      clearTimeout(this.hideTimeout);

      if (this.manuallyHidden) {
        this.controls.classList.add('hidden');
        btn.classList.add('ui-hidden');
      } else {
        this.controls.classList.remove('hidden');
        btn.classList.remove('ui-hidden');
        if (this._setInitialPosition) this._setInitialPosition();
      }
    };

    btn.addEventListener('click', toggle);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        toggle();
      }
    });
  }
}

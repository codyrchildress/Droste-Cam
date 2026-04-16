import vertexSrc from './shaders/vertex.glsl';
import sortFragSrc from './shaders/pixelsort.glsl';
import blitFragSrc from './shaders/blit.glsl';

export class PixelSortRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!this.gl) throw new Error('WebGL not supported');

    this.params = {
      threshold: 0.5,
      direction: 1,    // 0 = horizontal, 1 = vertical
      reverse: 0,
      intensity: 32,   // sort passes per frame
    };

    this.texAspect = 1.0;
    this.fbos = [null, null];
    this.fboWidth = 0;
    this.fboHeight = 0;

    this._initGL();
  }

  _initGL() {
    const gl = this.gl;

    const vs = this._compileShader(gl.VERTEX_SHADER, vertexSrc);

    // Sort pass program
    const sortFs = this._compileShader(gl.FRAGMENT_SHADER, sortFragSrc);
    this.sortProgram = this._linkProgram(vs, sortFs);
    this.sortAPos = gl.getAttribLocation(this.sortProgram, 'aPosition');
    this.sortUniforms = {
      uTexture: gl.getUniformLocation(this.sortProgram, 'uTexture'),
      uResolution: gl.getUniformLocation(this.sortProgram, 'uResolution'),
      uThreshold: gl.getUniformLocation(this.sortProgram, 'uThreshold'),
      uDirection: gl.getUniformLocation(this.sortProgram, 'uDirection'),
      uReverse: gl.getUniformLocation(this.sortProgram, 'uReverse'),
      uPass: gl.getUniformLocation(this.sortProgram, 'uPass'),
    };

    // Blit program (webcam→FBO init + FBO→screen display)
    const blitFs = this._compileShader(gl.FRAGMENT_SHADER, blitFragSrc);
    this.blitProgram = this._linkProgram(vs, blitFs);
    this.blitAPos = gl.getAttribLocation(this.blitProgram, 'aPosition');
    this.blitUniforms = {
      uTexture: gl.getUniformLocation(this.blitProgram, 'uTexture'),
      uTexAspect: gl.getUniformLocation(this.blitProgram, 'uTexAspect'),
      uFlipY: gl.getUniformLocation(this.blitProgram, 'uFlipY'),
    };

    // Shared quad buffer
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // Webcam texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  _linkProgram(vs, fs) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Shader link failed: ' + gl.getProgramInfoLog(program));
    }
    return program;
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + info);
    }
    return shader;
  }

  // --- FBO management ---

  _createFBO(w, h) {
    const gl = this.gl;

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { texture: tex, framebuffer: fb };
  }

  _destroyFBO(fbo) {
    if (!fbo) return;
    this.gl.deleteTexture(fbo.texture);
    this.gl.deleteFramebuffer(fbo.framebuffer);
  }

  _ensureFBOs() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.fboWidth === w && this.fboHeight === h) return;

    this._destroyFBO(this.fbos[0]);
    this._destroyFBO(this.fbos[1]);
    this.fbos[0] = this._createFBO(w, h);
    this.fbos[1] = this._createFBO(w, h);
    this.fboWidth = w;
    this.fboHeight = h;
  }

  // --- Public API ---

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(window.innerWidth, window.innerHeight);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  uploadTexture(video) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    this.texAspect = video.videoWidth / video.videoHeight || 1.0;
  }

  _useProgram(program, aPos) {
    const gl = this.gl;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this._ensureFBOs();

    // 1) Blit webcam → FBO 0 (Y-flip + aspect crop)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[0].framebuffer);
    gl.viewport(0, 0, w, h);
    this._useProgram(this.blitProgram, this.blitAPos);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.blitUniforms.uTexture, 0);
    gl.uniform1f(this.blitUniforms.uTexAspect, this.texAspect);
    gl.uniform1f(this.blitUniforms.uFlipY, 1.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2) Sort passes — ping-pong between FBO 0 and FBO 1
    let src = 0;
    let dst = 1;
    const numPasses = Math.max(1, Math.round(this.params.intensity));

    this._useProgram(this.sortProgram, this.sortAPos);
    gl.uniform1i(this.sortUniforms.uTexture, 0);
    gl.uniform2f(this.sortUniforms.uResolution, w, h);
    gl.uniform1f(this.sortUniforms.uThreshold, this.params.threshold);
    gl.uniform1f(this.sortUniforms.uDirection, this.params.direction);
    gl.uniform1f(this.sortUniforms.uReverse, this.params.reverse);

    for (let i = 0; i < numPasses; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[dst].framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fbos[src].texture);
      gl.uniform1f(this.sortUniforms.uPass, i & 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Swap
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    // 3) Display: FBO[src] → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    this._useProgram(this.blitProgram, this.blitAPos);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos[src].texture);
    gl.uniform1i(this.blitUniforms.uTexture, 0);
    gl.uniform1f(this.blitUniforms.uTexAspect, 1.0);
    gl.uniform1f(this.blitUniforms.uFlipY, 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

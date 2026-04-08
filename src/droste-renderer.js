import vertexSrc from './shaders/vertex.glsl';
import fragmentSrc from './shaders/droste.glsl';

export class DrosteRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!this.gl) throw new Error('WebGL not supported');

    this.params = {
      geometryX: 1.0,
      geometryY: -1.0,
      zoomSpeed: 0.3,
      showGrid: 0,
    };

    this.time = 0;
    this.animating = true;
    this.lastFrame = 0;

    this._initGL();
  }

  _initGL() {
    const gl = this.gl;

    const vs = this._compileShader(gl.VERTEX_SHADER, vertexSrc);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, fragmentSrc);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Shader link failed: ' + gl.getProgramInfoLog(this.program));
    }
    gl.useProgram(this.program);

    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      uTexture: gl.getUniformLocation(this.program, 'uTexture'),
      uResolution: gl.getUniformLocation(this.program, 'uResolution'),
      uGeometry: gl.getUniformLocation(this.program, 'uGeometry'),
      uZoomSpeed: gl.getUniformLocation(this.program, 'uZoomSpeed'),
      uTime: gl.getUniformLocation(this.program, 'uTime'),
      uTexAspect: gl.getUniformLocation(this.program, 'uTexAspect'),
      uShowGrid: gl.getUniformLocation(this.program, 'uShowGrid'),
    };

    this.texAspect = 1.0;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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

  render(timestamp) {
    const dt = (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;

    if (this.animating) {
      this.time += dt;
    }

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1i(this.uniforms.uTexture, 0);
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uniforms.uGeometry, this.params.geometryX, this.params.geometryY);
    gl.uniform1f(this.uniforms.uZoomSpeed, this.params.zoomSpeed);
    gl.uniform1f(this.uniforms.uTime, this.time);
    gl.uniform1f(this.uniforms.uTexAspect, this.texAspect);
    gl.uniform1f(this.uniforms.uShowGrid, this.params.showGrid);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

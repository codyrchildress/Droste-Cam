// Passthrough blit shader with optional Y-flip and aspect-ratio crop.
// Used to copy webcam → FBO (flip+crop) and FBO → screen (passthrough).
precision highp float;

uniform sampler2D uTexture;
uniform float uTexAspect;
uniform float uFlipY;

varying vec2 vUv;

vec2 cropToSquare(vec2 uv) {
  if (uTexAspect > 1.0) {
    float offset = (1.0 - 1.0 / uTexAspect) * 0.5;
    uv.x = uv.x / uTexAspect + offset;
  } else if (uTexAspect < 1.0) {
    float offset = (1.0 - uTexAspect) * 0.5;
    uv.y = uv.y * uTexAspect + offset;
  }
  return uv;
}

void main() {
  vec2 uv = vUv;
  if (uFlipY > 0.5) uv.y = 1.0 - uv.y;
  uv = cropToSquare(uv);
  gl_FragColor = texture2D(uTexture, uv);
}

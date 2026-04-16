// Odd-even transposition sort pass
// Each pass: adjacent pixel pairs compare and swap.
// O(1) per pixel per pass — run many passes via FBO ping-pong.
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uThreshold;
uniform float uDirection; // 0 = horizontal, 1 = vertical
uniform float uReverse;   // 0 = ascending, 1 = descending
uniform float uPass;      // 0 = even pairs, 1 = odd pairs

varying vec2 vUv;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 pixelSize = 1.0 / uResolution;

  // Pixel index along sort axis
  float coord = uDirection < 0.5 ? gl_FragCoord.x : gl_FragCoord.y;

  // Is this the "left" or "right" element of its comparison pair?
  bool isLeft = mod(coord + uPass, 2.0) < 1.0;

  // Neighbor offset
  vec2 sortDir = uDirection < 0.5 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  float offset = isLeft ? 1.0 : -1.0;
  vec2 neighborUv = vUv + sortDir * pixelSize * offset;

  vec4 myCol = texture2D(uTexture, vUv);

  // Bounds check — edge pixels can't swap
  if (neighborUv.x < 0.0 || neighborUv.x > 1.0 || neighborUv.y < 0.0 || neighborUv.y > 1.0) {
    gl_FragColor = myCol;
    return;
  }

  vec4 neighborCol = texture2D(uTexture, neighborUv);
  float myLum = luminance(myCol.rgb);
  float neighborLum = luminance(neighborCol.rgb);

  // Don't sort if either pixel is below threshold (acts as span boundary)
  if (myLum < uThreshold || neighborLum < uThreshold) {
    gl_FragColor = myCol;
    return;
  }

  // Left element should have lower luminance (ascending)
  bool needSwap = isLeft
    ? (myLum > neighborLum)
    : (neighborLum > myLum);

  if (uReverse > 0.5) needSwap = !needSwap;

  gl_FragColor = needSwap ? neighborCol : myCol;
}

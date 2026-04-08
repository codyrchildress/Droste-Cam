precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uGeometry;
uniform float uZoomSpeed;
uniform float uTime;
uniform float uTexAspect;
uniform float uShowGrid;

varying vec2 vUv;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

// Crop texture UV to center square of the webcam feed
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
  vec2 uv = vUv - 0.5;
  vec2 z = uv * 2.0;
  float r = length(z);

  if (r < 0.0001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 geo = uGeometry;
  float geoLenSq = dot(geo, geo);

  if (geoLenSq < 0.001) {
    gl_FragColor = texture2D(uTexture, cropToSquare(vUv));
    return;
  }

  // Log-polar coordinates: (ln|z|, arg(z))
  vec2 logZ = vec2(log(r), atan(z.y, z.x));

  // Decompose logZ into components parallel and perpendicular to geo.
  // Parallel direction: along geo = (gx, gy)
  // Perpendicular direction: (-gy, gx)
  float para = dot(logZ, geo) / geoLenSq;
  float perp = (logZ.x * geo.y - logZ.y * geo.x) / geoLenSq;

  // The angular period (0, 2pi) expressed in (para, perp) basis.
  // This is needed to eliminate the atan2 branch cut seam.
  float angPara = TWO_PI * geo.y / geoLenSq;
  float angPerp = TWO_PI * geo.x / geoLenSq;

  // Reduce modulo the angular period to remove the branch cut discontinuity
  if (abs(angPerp) > 0.001) {
    float n = floor(perp / angPerp);
    perp -= n * angPerp;
    para -= n * angPara;
  }

  // Animate zoom along the Droste direction
  para += uTime * uZoomSpeed;

  // Tile along the Droste direction (creates infinite self-similarity)
  para = fract(para);

  // Reconstruct log-polar coordinates from (para, perp) components
  vec2 newLogZ = para * geo + perp * vec2(-geo.y, geo.x);

  // Convert back to Cartesian
  vec2 finalZ = exp(newLogZ.x) * vec2(cos(newLogZ.y), sin(newLogZ.y));

  // Map to texture coordinates
  vec2 texUv = finalZ / 2.0 + 0.5;
  texUv = fract(texUv);
  texUv = cropToSquare(texUv);

  vec4 color = texture2D(uTexture, texUv);

  // Grid overlay: procedural grid in pre-warp UV space
  if (uShowGrid > 0.5) {
    // Grid in the warped texture coordinate space
    float gridFreq = 10.0;
    vec2 gridUv = texUv * gridFreq;
    vec2 gridLine = abs(fract(gridUv - 0.5) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.06, min(gridLine.x, gridLine.y));

    // Thicker lines at edges (every 5 cells)
    vec2 gridUv5 = texUv * (gridFreq / 5.0);
    vec2 gridLine5 = abs(fract(gridUv5 - 0.5) - 0.5);
    float majorLine = 1.0 - smoothstep(0.0, 0.04, min(gridLine5.x, gridLine5.y));

    // Color the grid: cyan minor lines, white major lines
    vec3 gridColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0), majorLine);
    float gridAlpha = max(line * 0.5, majorLine * 0.8);

    color.rgb = mix(color.rgb, gridColor, gridAlpha);
  }

  gl_FragColor = color;
}

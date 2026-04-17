precision highp float;

// Droste / Escher spiral via complex log + exp.
//
// Reference: B. de Smit & H. W. Lenstra (2003), "The Mathematical Structure
// of Escher's Print Gallery"; 3Blue1Brown, "This picture broke my brain"
// (https://youtu.be/ldxFjLJ3rVY).
//
// For each output pixel z = (lnr, theta) in complex log form, we sample the
// input at z_in = z_out^(1/alpha) where alpha = 1 - i*beta. That means:
//   lnr_in   = lnr - beta*theta    (shear -> cuts become log spirals)
//   theta_in = theta + beta*lnr    (rotation -> produces the visible spiral)
// Tiling lnr_in modulo log(scale) gives the recursive zoom. Picking
// beta = log(scale)/(2*pi) aligns one full rotation with exactly one zoom
// step, so the tile seam is hidden along angular continuity.

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uGeometry;    // x = log(scale), y = twist (rotations per zoom)
uniform float uZoomSpeed;
uniform float uTime;
uniform float uTexAspect;
uniform float uShowGrid;

varying vec2 vUv;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

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
  vec2 z = (vUv - 0.5) * 2.0;
  float r = length(z);

  if (r < 1e-5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float logScale = uGeometry.x;   // zoom period (log of scale ratio)
  float twist    = uGeometry.y;   // rotations per zoom level

  if (abs(logScale) < 1e-3) {
    gl_FragColor = texture2D(uTexture, cropToSquare(vUv));
    return;
  }

  float period = abs(logScale);
  // beta controls the spiral tightness. twist == 1 makes the seam align
  // with the angular 2*pi branch -> seamless spiral.
  float beta = twist * logScale / TWO_PI;

  // Complex log of z.
  float lnr   = log(r);
  float theta = atan(z.y, z.x);

  // Inverse Escher map (scaled): log(z_in) = log(z_out) * conj(alpha).
  float lnr_in   = lnr   - beta * theta;
  float theta_in = theta + beta * lnr;

  // Animate: push zoom along +sign(logScale) direction.
  lnr_in += uTime * uZoomSpeed * sign(logScale);

  // Wrap lnr_in into one tile, then shift into (-period, 0] so the sample
  // radius lands in (exp(-period), 1] — the unit disc.
  lnr_in = mod(lnr_in, period) - period;

  float r_in = exp(lnr_in);
  vec2 sample_pos = r_in * vec2(cos(theta_in), sin(theta_in));

  vec2 texUv = sample_pos * 0.5 + 0.5;
  texUv = cropToSquare(texUv);
  texUv = clamp(texUv, 0.0, 1.0);

  vec4 color = texture2D(uTexture, texUv);

  if (uShowGrid > 0.5) {
    // Grid drawn in the sheared log-polar space — visualizes the warp.
    vec2 gridCoord = vec2(lnr_in / period, theta_in / TWO_PI);
    float gridFreq = 10.0;
    vec2 gridLine = abs(fract(gridCoord * gridFreq - 0.5) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.06, min(gridLine.x, gridLine.y));

    vec2 gridLine5 = abs(fract(gridCoord * (gridFreq / 5.0) - 0.5) - 0.5);
    float majorLine = 1.0 - smoothstep(0.0, 0.04, min(gridLine5.x, gridLine5.y));

    vec3 gridColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0), majorLine);
    float gridAlpha = max(line * 0.5, majorLine * 0.8);
    color.rgb = mix(color.rgb, gridColor, gridAlpha);
  }

  gl_FragColor = color;
}

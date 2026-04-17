precision highp float;

// Droste / Escher spiral via complex log + exp.
//
// Reference: B. de Smit & H. W. Lenstra (2003), "The Mathematical Structure
// of Escher's Print Gallery"; 3Blue1Brown, "This picture broke my brain"
// (https://youtu.be/ldxFjLJ3rVY).
//
// For each output pixel z = r * e^(i*theta), apply the inverse Escher shear
// in log-polar space:
//   lnr_in   = log(r) - beta*theta     (shear -> tile boundary becomes spiral)
//   theta_in = theta  + beta*log(r)    (rotation -> creates visible spiral)
// with beta = twist * log(scale) / (2*pi).
//
// Crucially, we treat the whole webcam as a rectangle that tiles the
// fundamental domain of the (lnr_in, theta_in) strip. That is, the webcam
// fills (lnr_in, theta_in) mod (log(scale), 2*pi) linearly. No inner-disc /
// outer-disc split, so there is no circular seam. When twist = 1, the
// shear makes one zoom level line up with one full rotation and both wraps
// happen together along a logarithmic spiral -- the seam that remains is a
// thin spiral line that is hidden by angular continuity for many scenes.

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

// Compensate for non-square webcam aspect inside the unit UV square.
vec2 fitAspect(vec2 uv) {
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

  float logScale = uGeometry.x;   // zoom period in ln-r
  float twist    = uGeometry.y;   // rotations per zoom level

  if (abs(logScale) < 1e-3) {
    gl_FragColor = texture2D(uTexture, fitAspect(vUv));
    return;
  }

  float period = abs(logScale);
  float beta   = twist * logScale / TWO_PI;

  float lnr   = log(r);
  float theta = atan(z.y, z.x);

  // Inverse Escher shear.
  float lnr_in   = lnr   - beta * theta;
  float theta_in = theta + beta * lnr;

  // Animate along the zoom direction.
  lnr_in += uTime * uZoomSpeed * sign(logScale);

  // Map log-polar coordinate into the webcam rectangle. One fundamental
  // strip (period in lnr, 2*pi in theta) covers the webcam linearly.
  // Plain fract() is essential here: across the atan2 branch cut the
  // shear produces a jump of exactly (period, 2*pi), which equals one
  // full lattice cell and is absorbed by fract(). Mirror-wrap would
  // instead treat the jump as a reflection and produce a horizontal
  // seam across the image.
  vec2 stripUv = vec2(fract(lnr_in / period),
                      fract(theta_in / TWO_PI + 0.5));
  vec2 texUv = fitAspect(stripUv);

  vec4 color = texture2D(uTexture, texUv);

  if (uShowGrid > 0.5) {
    // Grid drawn in the sheared (lnr_in, theta_in) space -- shows how the
    // webcam strip tiles through the output.
    float gridFreq = 10.0;
    vec2 gridCoord = vec2(lnr_in / period, theta_in / TWO_PI) * gridFreq;
    vec2 gridLine = abs(fract(gridCoord - 0.5) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.06, min(gridLine.x, gridLine.y));

    vec2 gridLine5 = abs(fract(gridCoord * 0.2 - 0.5) - 0.5);
    float majorLine = 1.0 - smoothstep(0.0, 0.04, min(gridLine5.x, gridLine5.y));

    vec3 gridColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0), majorLine);
    float gridAlpha = max(line * 0.5, majorLine * 0.8);
    color.rgb = mix(color.rgb, gridColor, gridAlpha);
  }

  gl_FragColor = color;
}

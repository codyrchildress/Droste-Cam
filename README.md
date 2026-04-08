[![Droste Cam Demo](https://img.youtube.com/vi/SKN0NB4RGvc/maxresdefault.jpg)](https://youtu.be/SKN0NB4RGvc)

# Droste Cam

A real-time Droste effect applied to your webcam using WebGL shaders. Based on the Lenstra/de Smit complex logarithm method for self-referencing images.

## Features

- **Real-time webcam Droste effect** via WebGL fragment shader
- **Geometry control** — 2D draggable pad controlling the complex period parameter
- **Spring physics** on the geometry point with configurable stiffness, damping, and mass
- **Animated zoom** that continuously spirals inward
- **Grid overlay** to visualize the warping transformation
- **Camera selector** to switch between video inputs
- **Draggable controls panel** with auto-hide

## Getting Started

```bash
npm install
npm run dev
```

## Keyboard Shortcuts

- **H** — Toggle controls visibility
- **G** — Toggle grid overlay

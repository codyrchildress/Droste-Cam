export class Webcam {
  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.stream = null;
    this.active = false;
    this.currentDeviceId = null;
  }

  async start(deviceId) {
    try {
      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      // Track which device we're using
      const track = this.stream.getVideoTracks()[0];
      this.currentDeviceId = track.getSettings().deviceId || deviceId;

      this.video.srcObject = this.stream;
      await this.video.play();
      this.active = true;
      return true;
    } catch (err) {
      console.error('Webcam access failed:', err);
      this.active = false;
      throw err;
    }
  }

  async switchDevice(deviceId) {
    this.stop();
    return this.start(deviceId);
  }

  async getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.active = false;
  }

  get width() {
    return this.video.videoWidth || 640;
  }

  get height() {
    return this.video.videoHeight || 480;
  }

  get element() {
    return this.video;
  }

  get ready() {
    return this.active && this.video.readyState >= 2;
  }
}

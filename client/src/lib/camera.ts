interface CameraConstraints extends MediaTrackConstraints {
  width: { ideal: number };
  height: { ideal: number };
  facingMode: { ideal: VideoFacingModeEnum };
}

let currentStream: MediaStream | null = null;

export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Error accessing camera devices:', error);
    throw new Error('Unable to access camera devices. Please ensure camera permissions are granted.');
  }
}

export async function startCamera(
  videoElement: HTMLVideoElement,
  constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    }
  }
): Promise<void> {
  console.log('Starting camera with constraints:', constraints);
  
  if (!videoElement) {
    throw new Error('Video element is required');
  }

  // Stop any existing stream first
  stopCamera();

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    videoElement.srcObject = stream;
    
    // Wait for the video to be ready
    await new Promise<void>((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(resolve).catch(console.error);
      };
    });
  } catch (error) {
    console.error('Error accessing camera:', error);
    throw new Error('Could not access the camera. Please ensure you have granted camera permissions.');
  }
}

export function stopCamera(): void {
  if (currentStream) {
    currentStream.getTracks().forEach(track => {
      track.stop();
    });
    currentStream = null;
  }
}

export function captureFrame(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  context.drawImage(videoElement, 0, 0);
  
  // Return base64 encoded image data
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function checkCameraSupport(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Clean up on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopCamera();
  });
}

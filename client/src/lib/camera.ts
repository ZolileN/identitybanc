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
  videoElement: HTMLVideoElement | null,
  deviceId?: string
): Promise<void> {
  console.log('Starting camera with device:', deviceId || 'default');
  
  if (!videoElement) {
    console.error('Video element is not provided');
    throw new Error('Video element is not provided');
  }

  // Stop any existing stream first
  stopCamera();

  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' })
    },
    audio: false
  };

  console.log('Requesting camera with constraints:', constraints);

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Got camera stream:', stream.id);
    
    if (!videoElement || !document.body.contains(videoElement)) {
      console.error('Video element is no longer in the document');
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Video element is no longer in the document');
    }

    videoElement.srcObject = stream;
    currentStream = stream;

    // Wait for the video to be ready
    return new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(() => {
          console.log('Video is playing');
          resolve();
        }).catch(err => {
          console.error('Error playing video:', err);
          throw new Error('Could not play video: ' + err.message);
        });
      };
    });
  } catch (error) {
    console.error('Error in startCamera:', error);
    throw error;
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

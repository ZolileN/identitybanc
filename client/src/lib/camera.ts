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
  // Check if video element exists
  if (!videoElement) {
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

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Check if the video element is still valid
    if (!videoElement || !document.body.contains(videoElement)) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Video element is no longer in the document');
    }

    videoElement.srcObject = stream;
    currentStream = stream;

    return new Promise((resolve, reject) => {
      const onLoaded = () => {
        videoElement?.play()
          .then(resolve)
          .catch(error => {
            console.error('Video play error:', error);
            reject(new Error('Failed to play video stream'));
          });
      };

      const onError = (error: Event | string) => {
        console.error('Video error:', error);
        reject(new Error('Error initializing video stream'));
      };

      videoElement.onloadedmetadata = onLoaded;
      videoElement.onerror = onError;

      // Clean up event listeners after they're no longer needed
      const cleanup = () => {
        videoElement.onloadedmetadata = null;
        videoElement.onerror = null;
      };

      // Set a timeout in case the video never loads
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Video stream initialization timed out'));
      }, 10000);

      // Clean up on resolve/reject
      Promise.resolve()
        .then(() => videoElement.onloadedmetadata)
        .finally(() => {
          clearTimeout(timeout);
          cleanup();
        });
    });
  } catch (error) {
    console.error('Camera access error:', error);
    
    let errorMessage = 'Failed to access camera';
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access was denied. Please grant camera permissions to continue.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'The requested camera configuration is not supported.';
      } else if (error instanceof DOMException) {
        errorMessage = `Camera error: ${error.message}`;
      }
    }
    
    throw new Error(errorMessage);
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

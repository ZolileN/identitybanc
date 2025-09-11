let currentStream: MediaStream | null = null;

export async function startCamera(videoElement: HTMLVideoElement): Promise<void> {
  try {
    // Request camera access with high resolution
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    videoElement.srcObject = stream;
    currentStream = stream;

    return new Promise((resolve, reject) => {
      videoElement.onloadedmetadata = () => {
        resolve();
      };
      videoElement.onerror = reject;
    });
  } catch (error) {
    console.error('Camera access error:', error);
    throw new Error('Failed to access camera. Please ensure camera permissions are granted.');
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

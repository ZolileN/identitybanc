import * as faceapi from 'face-api.js';

interface LivenessData {
  blinkDetected: boolean;
  headMovement: boolean;
  facePresent: boolean;
  faceAngle: { pitch: number; roll: number; yaw: number };
  eyeAspectRatio: number;
  timestamp: number;
}

// Constants
const EYE_AR_THRESHOLD = 0.23;
const HEAD_ANGLE_THRESHOLD = 20;

// State
let eyeAspectRatios: number[] = [];
let blinkCounter = 0;
let headPositions: { yaw: number; pitch: number }[] = [];

// Helper functions
function getEyeAspectRatio(eye: faceapi.Point[]): number {
  const v1 = faceapi.euclideanDistance(
    [eye[1].x, eye[1].y] as [number, number],
    [eye[5].x, eye[5].y] as [number, number]
  );
  const v2 = faceapi.euclideanDistance(
    [eye[2].x, eye[2].y] as [number, number],
    [eye[4].x, eye[4].y] as [number, number]
  );
  const h = faceapi.euclideanDistance(
    [eye[0].x, eye[0].y] as [number, number],
    [eye[3].x, eye[3].y] as [number, number]
  );
  return (v1 + v2) / (2 * h);
}

interface HeadPose {
  rotation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  translation: {
    x: number;
    y: number;
    z: number;
  };
}

export async function detectLiveness(videoElement: HTMLVideoElement): Promise<LivenessData> {
  let detections;
  
  try {
    detections = await faceapi
      .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();
  } catch (error) {
    console.error('Face detection error:', error);
    return {
      blinkDetected: false,
      headMovement: false,
      facePresent: false,
      faceAngle: { pitch: 0, roll: 0, yaw: 0 },
      eyeAspectRatio: 0,
      timestamp: Date.now(),
    };
  }

  if (!detections || detections.length === 0) {
    return {
      blinkDetected: false,
      headMovement: false,
      facePresent: false,
      faceAngle: { pitch: 0, roll: 0, yaw: 0 },
      eyeAspectRatio: 0,
      timestamp: Date.now(),
    };
  }

  const face = detections[0];
  const landmarks = face.landmarks;
  
  // Calculate eye aspect ratio for both eyes
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const ear = (getEyeAspectRatio(leftEye) + getEyeAspectRatio(rightEye)) / 2;
  
  // Update eye aspect ratio history
  eyeAspectRatios.push(ear);
  if (eyeAspectRatios.length > 10) eyeAspectRatios.shift();
  if (ear < EYE_AR_THRESHOLD) blinkCounter++;

  // Initialize default pose values
  let pitch = 0;
  let yaw = 0;
  let roll = 0;

  try {
    // Try to estimate head pose if available in the API
    if ('estimateHeadPose' in faceapi) {
      const size = {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
      };
      
      const pose = (faceapi.estimateHeadPose as any)(landmarks, size) as HeadPose;
      if (pose && pose.rotation) {
        pitch = pose.rotation.pitch || 0;
        yaw = pose.rotation.yaw || 0;
        roll = pose.rotation.roll || 0;
      }
    }
  } catch (error) {
    console.warn('Head pose estimation failed:', error);
  }

  // Track head positions
  headPositions.push({ yaw, pitch });
  if (headPositions.length > 30) headPositions.shift();
  
  // Check for head movement
  let headMovement = false;
  if (headPositions.length > 1) {
    const first = headPositions[0];
    const last = headPositions[headPositions.length - 1];
    headMovement = Math.abs(last.yaw - first.yaw) > HEAD_ANGLE_THRESHOLD ||
                  Math.abs(last.pitch - first.pitch) > HEAD_ANGLE_THRESHOLD;
  }

  return {
    blinkDetected: blinkCounter >= 2,
    headMovement,
    facePresent: true,
    faceAngle: { pitch, roll, yaw },
    eyeAspectRatio: ear,
    timestamp: Date.now(),
  };
}

export function resetLivenessDetection() {
  eyeAspectRatios = [];
  blinkCounter = 0;
  headPositions = [];
}

export async function analyzeFaceMatch(idPhotoData: string, livePhotoData: string): Promise<number> {
  const [idImage, liveImage] = await Promise.all([
    faceapi.fetchImage(idPhotoData),
    faceapi.fetchImage(livePhotoData)
  ]);
  
  const [idDescriptor, liveDescriptor] = await Promise.all([
    faceapi.detectSingleFace(idImage, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor(),
    faceapi.detectSingleFace(liveImage, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()
  ]);

  if (!idDescriptor || !liveDescriptor) {
    throw new Error('Could not detect faces in one or both images');
  }

  const distance = faceapi.euclideanDistance(
    idDescriptor.descriptor,
    liveDescriptor.descriptor
  );
  
  return Math.round(Math.max(0, 1 - distance / 0.6) * 100);
}

export function detectFraud(sessionData: any): Promise<boolean> {
  // Mock fraud detection
  // In production, this would analyze multiple factors:
  // - Document authenticity
  // - Behavioral biometrics
  // - Device fingerprinting
  // - Historical patterns
  
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock: 95% chance of passing fraud check
      resolve(Math.random() > 0.05);
    }, 1000);
  });
}

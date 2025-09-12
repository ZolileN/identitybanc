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
function getEyeAspectRatio(eye: faceapi.Point[]) {
  const v1 = faceapi.euclideanDistance(eye[1], eye[5]);
  const v2 = faceapi.euclideanDistance(eye[2], eye[4]);
  const h = faceapi.euclideanDistance(eye[0], eye[3]);
  return (v1 + v2) / (2 * h);
}

export async function detectLiveness(videoElement: HTMLVideoElement): Promise<LivenessData> {
  const detections = await faceapi
    .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  if (detections.length === 0) {
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
  
  // Eye aspect ratio calculation
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const ear = (getEyeAspectRatio(leftEye) + getEyeAspectRatio(rightEye)) / 2;
  
  // Update eye aspect ratio history
  eyeAspectRatios.push(ear);
  if (eyeAspectRatios.length > 10) eyeAspectRatios.shift();
  if (ear < EYE_AR_THRESHOLD) blinkCounter++;

  // Head pose tracking
  const { pitch, yaw, roll } = face.angle || { pitch: 0, yaw: 0, roll: 0 };
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

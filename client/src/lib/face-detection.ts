import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
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
const MAX_FRAME_RATE = 30; // Increased from 15 to 30 FPS with BlazeFace
const POSE_ESTIMATION_INTERVAL = 3;

// State
let eyeAspectRatios: number[] = [];
let blinkCounter = 0;
let headPositions: { yaw: number; pitch: number }[] = [];
let lastFrameTime = 0;
let frameCount = 0;
let model: blazeface.BlazeFaceModel | null = null;

// Initialize BlazeFace model
let isModelLoading = false;
let modelLoadPromise: Promise<blazeface.BlazeFaceModel> | null = null;

async function loadModel(): Promise<blazeface.BlazeFaceModel> {
  if (model) return model;
  if (isModelLoading && modelLoadPromise) return modelLoadPromise;
  
  isModelLoading = true;
  modelLoadPromise = blazeface.load({
    maxFaces: 1,
    inputWidth: 128,
    inputHeight: 128,
    iouThreshold: 0.3,
    scoreThreshold: 0.75
  });
  
  try {
    model = await modelLoadPromise;
    return model;
  } finally {
    isModelLoading = false;
  }
}

// Helper functions
function shouldProcessFrame(): boolean {
  const now = performance.now();
  const timeSinceLastFrame = now - lastFrameTime;
  const targetFrameTime = 1000 / MAX_FRAME_RATE;
  
  if (timeSinceLastFrame >= targetFrameTime) {
    lastFrameTime = now - (timeSinceLastFrame % targetFrameTime);
    return true;
  }
  return false;
}

function getEyeAspectRatio(landmarks: number[][]): number {
  // BlazeFace returns 6 facial landmarks in this order:
  // right eye, left eye, nose, mouth, right ear, left ear
  const rightEye = landmarks[0];
  const leftEye = landmarks[1];
  
  // Calculate eye aspect ratio for both eyes and average them
  const rightEAR = calculateEAR([
    [rightEye[0], rightEye[1]],
    [rightEye[2], rightEye[3]],
    [rightEye[4], rightEye[5]],
    [rightEye[6], rightEye[7]],
    [rightEye[8], rightEye[9]],
    [rightEye[10], rightEye[11]]
  ]);
  
  const leftEAR = calculateEAR([
    [leftEye[0], leftEye[1]],
    [leftEye[2], leftEye[3]],
    [leftEye[4], leftEye[5]],
    [leftEye[6], leftEye[7]],
    [leftEye[8], leftEye[9]],
    [leftEye[10], leftEye[11]]
  ]);
  
  return (rightEAR + leftEAR) / 2;
}

function calculateEAR(eyePoints: number[][]): number {
  // Calculate vertical distances
  const v1 = Math.hypot(
    eyePoints[1][0] - eyePoints[5][0],
    eyePoints[1][1] - eyePoints[5][1]
  );
  const v2 = Math.hypot(
    eyePoints[2][0] - eyePoints[4][0],
    eyePoints[2][1] - eyePoints[4][1]
  );
  
  // Calculate horizontal distance
  const h = Math.hypot(
    eyePoints[0][0] - eyePoints[3][0],
    eyePoints[0][1] - eyePoints[3][1]
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
  // Early exit if already detected in previous frames
  if (blinkCounter >= 2 && headPositions.length > 1) {
    const first = headPositions[0];
    const last = headPositions[headPositions.length - 1];
    const headMovement = Math.abs(last.yaw - first.yaw) > HEAD_ANGLE_THRESHOLD ||
                         Math.abs(last.pitch - first.pitch) > HEAD_ANGLE_THRESHOLD;
    if (headMovement) {
      return {
        blinkDetected: true,
        headMovement: true,
        facePresent: true,
        faceAngle: { pitch: last.pitch, roll: 0, yaw: last.yaw },
        eyeAspectRatio: eyeAspectRatios[eyeAspectRatios.length - 1] || 0,
        timestamp: Date.now(),
      };
    }
  }

  // Skip frames to maintain target frame rate
  if (!shouldProcessFrame()) {
    return {
      blinkDetected: false,
      headMovement: false,
      facePresent: false,
      faceAngle: { pitch: 0, roll: 0, yaw: 0 },
      eyeAspectRatio: 0,
      timestamp: Date.now(),
    };
  }

  // Initialize model if not loaded
  if (!model) {
    try {
      await loadModel();
      if (!model) {
        throw new Error('Failed to load BlazeFace model');
      }
    } catch (error) {
      console.error('Error loading BlazeFace model:', error);
      return {
        blinkDetected: false,
        headMovement: false,
        facePresent: false,
        faceAngle: { pitch: 0, roll: 0, yaw: 0 },
        eyeAspectRatio: 0,
        timestamp: Date.now(),
      };
    }
  }

  try {
    // Run face detection
    if (!model) {
      throw new Error('Model not loaded');
    }
    
    const predictions = await model.estimateFaces(videoElement, false);
    
    if (!predictions || predictions.length === 0) {
      return {
        blinkDetected: false,
        headMovement: false,
        facePresent: false,
        faceAngle: { pitch: 0, roll: 0, yaw: 0 },
        eyeAspectRatio: 0,
        timestamp: Date.now(),
      };
    }

    // Get the first face prediction
    const face = predictions[0];
    
    // Calculate EAR (Eye Aspect Ratio)
    const ear = getEyeAspectRatio(face.landmarks as number[][]);
    eyeAspectRatios.push(ear);
    
    // Detect blinks
    if (ear < EYE_AR_THRESHOLD) {
      blinkCounter++;
    }
    
    // Simplified head pose estimation (pitch and yaw)
    // Note: You might want to implement proper head pose estimation using the landmarks
    const pitch = 0;
    const yaw = 0;
    
    headPositions.push({ pitch, yaw });
    
    // Keep only recent frames
    if (headPositions.length > 30) {
      headPositions.shift();
    }
    
    return {
      blinkDetected: blinkCounter >= 2,
      headMovement: false, // Will be determined in next frame
      facePresent: true,
      faceAngle: { pitch, roll: 0, yaw },
      eyeAspectRatio: ear,
      timestamp: Date.now(),
    };
    
  } catch (error) {
    console.error('Error in face detection:', error);
    return {
      blinkDetected: false,
      headMovement: false,
      facePresent: false,
      faceAngle: { pitch: 0, roll: 0, yaw: 0 },
      eyeAspectRatio: 0,
      timestamp: Date.now(),
    };
  }
}

export function resetLivenessDetection(): void {
  console.log('Resetting liveness detection state');
  eyeAspectRatios = [];
  blinkCounter = 0;
  headPositions = [];
  lastFrameTime = 0;
  frameCount = 0;
  // Don't reset the model here, keep it loaded for better performance
}

export async function analyzeFaceMatch(idPhotoData: string, livePhotoData: string): Promise<number> {
  // For face matching, we'll continue using face-api.js as it has better face recognition
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

  // Convert distance to similarity score (0-1)
  return Math.max(0, 1 - distance / 1.5);
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

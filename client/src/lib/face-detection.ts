import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';

interface LivenessData {
  blinkDetected: boolean;
  headMovement: boolean;
  facePresent: boolean;
  faceAngle: { pitch: number; roll: number; yaw: number };
  eyeAspectRatio: number;
  timestamp: number;
}

interface MobileNetModel {
  infer: (
    img: tf.Tensor3D | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    embedding?: boolean
  ) => tf.Tensor2D;
}

// Constants
const EYE_AR_THRESHOLD = 0.23;
const HEAD_ANGLE_THRESHOLD = 20;
const MAX_FRAME_RATE = 30;
const POSE_ESTIMATION_INTERVAL = 3;

// State
let eyeAspectRatios: number[] = [];
let blinkCounter = 0;
let headPositions: { yaw: number; pitch: number }[] = [];
let lastFrameTime = 0;
let frameCount = 0;

// Models
let mobileNet: MobileNetModel | null = null;
let faceLandmarkModel: any = null;

// Model loading state
let isModelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

// Helper function for default response
function getDefaultLivenessData(reason: string): LivenessData {
  console.log('Returning default liveness data:', reason);
  return {
    blinkDetected: false,
    headMovement: false,
    facePresent: false,
    faceAngle: { pitch: 0, roll: 0, yaw: 0 },
    eyeAspectRatio: 0,
    timestamp: Date.now(),
  };
}

export async function loadModels() {
  if (mobileNet && faceLandmarkModel) {
    console.log('Models already loaded');
    return;
  }

  if (isModelLoading && modelLoadPromise) {
    console.log('Models are already loading...');
    return modelLoadPromise;
  }

  console.log('Loading models...');
  isModelLoading = true;

  try {
    modelLoadPromise = Promise.all([
      // Load MobileNet for feature extraction
      (async () => {
        const model = await mobilenet.load();
        return {
          infer: (img: any, embedding = false) => {
            return model.infer(img, embedding) as tf.Tensor2D;
          }
        };
      })(),
      
      // Load Face Landmark Detection
      faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'mediapipe',
          maxFaces: 1,
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
          refineLandmarks: true
        }
      )
    ]).then(([mobilenetModel, landmarkModel]) => {
      mobileNet = mobilenetModel as MobileNetModel;
      faceLandmarkModel = landmarkModel;
      console.log('All models loaded successfully');
    });

    await modelLoadPromise;
  } catch (error) {
    console.error('Error loading models:', error);
    isModelLoading = false;
    modelLoadPromise = null;
    throw new Error(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

export async function detectLiveness(videoElement: HTMLVideoElement): Promise<LivenessData> {
  // Add video element validation
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    console.error('Video element not properly initialized');
    return getDefaultLivenessData('Video element not ready');
  }

  // Load models if not already loaded
  if (!mobileNet || !faceLandmarkModel) {
    try {
      console.log('Models not loaded, loading now...');
      await loadModels();
    } catch (error) {
      console.error('Failed to load models:', error);
      return getDefaultLivenessData('Failed to load models');
    }
  }

  // Skip frames to maintain target frame rate
  if (!shouldProcessFrame()) {
    return getDefaultLivenessData('Skipping frame');
  }

  try {
    // Get face landmarks for more accurate eye detection
    const faces = await faceLandmarkModel.estimateFaces({
      input: videoElement,
      returnTensors: false,
      flipHorizontal: false,
      predictIrises: true
    });

    if (!faces || faces.length === 0) {
      return getDefaultLivenessData('No face landmarks detected');
    }

    const face = faces[0];
    const keypoints = face.scaledMesh;
    
    // Calculate eye aspect ratio (EAR)
    const leftEye = [
      keypoints[33], keypoints[160], keypoints[158], 
      keypoints[133], keypoints[153], keypoints[144]
    ];
    const rightEye = [
      keypoints[362], keypoints[385], keypoints[387],
      keypoints[263], keypoints[373], keypoints[380]
    ];
    
    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const ear = (leftEAR + rightEAR) / 2;
    
    // Detect blink
    eyeAspectRatios.push(ear);
    if (eyeAspectRatios.length > 5) {
      eyeAspectRatios.shift();
      
      // Check for blink (temporary drop in EAR)
      const avgEAR = eyeAspectRatios.reduce((a, b) => a + b, 0) / eyeAspectRatios.length;
      if (ear < avgEAR * 0.7) {
        blinkCounter++;
      }
    }
    
    // Simple head pose estimation (using nose position)
    const nose = keypoints[1];
    const leftMouth = keypoints[61];
    const rightMouth = keypoints[291];
    
    const mouthWidth = Math.hypot(
      rightMouth[0] - leftMouth[0],
      rightMouth[1] - leftMouth[1]
    );
    
    const noseToMouth = Math.hypot(
      nose[0] - (leftMouth[0] + rightMouth[0]) / 2,
      nose[1] - (leftMouth[1] + rightMouth[1]) / 2
    );
    
    // Simple head pose estimation (pitch and yaw)
    const pitch = (nose[1] - videoElement.videoHeight / 2) / (videoElement.videoHeight / 2);
    const yaw = (nose[0] - videoElement.videoWidth / 2) / (videoElement.videoWidth / 2);
    
    // Track head positions
    headPositions.push({ pitch, yaw });
    if (headPositions.length > 30) {
      headPositions.shift();
    }
    
    // Check for head movement
    let headMovement = false;
    if (headPositions.length > 5) {
      const first = headPositions[0];
      const last = headPositions[headPositions.length - 1];
      const deltaYaw = Math.abs(last.yaw - first.yaw);
      const deltaPitch = Math.abs(last.pitch - first.pitch);
      
      headMovement = deltaYaw > 0.2 || deltaPitch > 0.2;
    }
    
    return {
      blinkDetected: blinkCounter > 0,
      headMovement,
      facePresent: true,
      faceAngle: { pitch, roll: 0, yaw },
      eyeAspectRatio: ear,
      timestamp: Date.now(),
    };
    
  } catch (error) {
    console.error('Error in face detection:', error);
    return getDefaultLivenessData('Error in face detection');
  }
}

export function resetLivenessDetection(): void {
  console.log('Resetting liveness detection state');
  eyeAspectRatios = [];
  blinkCounter = 0;
  headPositions = [];
  lastFrameTime = 0;
  frameCount = 0;
}

export async function analyzeFaceMatch(idPhotoData: string, livePhotoData: string): Promise<number> {
  if (!mobileNet) {
    await loadModels();
    if (!mobileNet) {
      throw new Error('Failed to load MobileNet model');
    }
  }

  try {
    // Convert base64 images to tensors
    const idTensor = await loadImageTensor(idPhotoData);
    const liveTensor = await loadImageTensor(livePhotoData);
    
    // Get embeddings
    const idEmbedding = mobileNet.infer(idTensor, true);
    const liveEmbedding = mobileNet.infer(liveTensor, true);
    
    // Calculate cosine similarity
    const similarity = cosineSimilarity(
      (await idEmbedding.array() as number[][])[0],
      (await liveEmbedding.array() as number[][])[0]
    );
    
    // Clean up
    idTensor.dispose();
    liveTensor.dispose();
    
    return similarity;
  } catch (error) {
    console.error('Error analyzing face match:', error);
    throw new Error('Failed to analyze face match');
  }
}

async function loadImageTensor(imageData: string): Promise<tf.Tensor3D> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tensor = tf.browser.fromPixels(img);
      const resized = tf.image.resizeBilinear(tensor, [224, 224]);
      const normalized = resized.toFloat().div(127).sub(1);
      tf.dispose([tensor, resized]);
      resolve(normalized as tf.Tensor3D);
    };
    img.onerror = reject;
    img.src = imageData;
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  return dot / (normA * normB);
}

import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Loads all required face-api.js models with error handling
 */
export async function loadFaceApiModels() {
  if (modelsLoaded) {
    console.log('Face API models already loaded');
    return;
  }
  
  if (isLoading && loadPromise) {
    console.log('Face API models are already loading...');
    return loadPromise;
  }

  console.log('Loading Face API models...');
  isLoading = true;
  
  try {
    // Path to models in the public directory
    const MODEL_URL = '/models';
    
    loadPromise = Promise.all([
      // Tiny Face Detector - faster but less accurate
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      
      // Face Landmark 68 - for facial landmarks (eyes, nose, mouth, etc.)
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      
      // Face Recognition - for face descriptors
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      
      // Face Expression - for emotion detection (optional)
      // faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      
      // Age and Gender detection (optional)
      // faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
    ]).then(() => {
      console.log('All Face API models loaded successfully');
      modelsLoaded = true;
      isLoading = false;
    });

    return loadPromise;
  } catch (error: unknown) {
    console.error('Failed to load Face API models:', error);
    isLoading = false;
    modelsLoaded = false;
    loadPromise = null;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to load face detection models: ${errorMessage}`);
  }
}

/**
 * Checks if models are loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Resets the loaded state (useful for testing)
 */
export function resetModelsLoadedState(): void {
  modelsLoaded = false;
  isLoading = false;
  loadPromise = null;
}
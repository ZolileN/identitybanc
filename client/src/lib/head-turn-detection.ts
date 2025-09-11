import * as faceapi from 'face-api.js';

export async function waitForHeadTurn(video: HTMLVideoElement, timeout = 8000) {
  let left = false, right = false;
  const start = Date.now();

  while (Date.now() - start < timeout && (!left || !right)) {
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (detection && detection.landmarks) {
      const nose = detection.landmarks.getNose();
      const jaw = detection.landmarks.getJawOutline();
      const faceCenterX = (jaw[0].x + jaw[16].x) / 2;
      const noseX = nose[3].x;
      const offset = noseX - faceCenterX;
      if (offset < -10) left = true; // Head turned left
      if (offset > 10) right = true; // Head turned right
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return left && right;
}
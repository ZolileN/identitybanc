import * as faceapi from 'face-api.js';

function getEAR(eye: faceapi.Point[]) {
  // Eye Aspect Ratio formula
  const a = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const b = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const c = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  return (a + b) / (2.0 * c);
}

export async function waitForBlink(video: HTMLVideoElement, blinkCount = 2, timeout = 8000) {
  let blinks = 0;
  let lastClosed = false;
  const start = Date.now();

  while (Date.now() - start < timeout && blinks < blinkCount) {
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    if (detection && detection.landmarks) {
      const leftEye = detection.landmarks.getLeftEye();
      const rightEye = detection.landmarks.getRightEye();
      const leftEAR = getEAR(leftEye);
      const rightEAR = getEAR(rightEye);
      const ear = (leftEAR + rightEAR) / 2;
      if (ear < 0.22) { // Threshold for closed eyes
        if (!lastClosed) {
          blinks++;
          lastClosed = true;
        }
      } else {
        lastClosed = false;
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return blinks >= blinkCount;
}
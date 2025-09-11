import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { loadFaceApiModels } from "@/lib/face-api-loader";

export default function TestFaceApi() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Loading models...");

  useEffect(() => {
    async function run() {
      try {
        await loadFaceApiModels();
        setStatus("Models loaded. Starting camera...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setStatus("Camera started. Detecting face...");
            detect();
          };
        }
      } catch (e) {
        setStatus("Error: " + (e as Error).message);
      }
    }

    async function detect() {
      if (!videoRef.current) return;
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();
      if (detection) {
        setStatus("Face detected! 🎉");
      } else {
        setStatus("No face detected. Try again.");
      }
    }

    run();
    // Cleanup
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div>
      <h2>Face API Test</h2>
      <p>{status}</p>
      <video ref={videoRef} width={320} height={240} style={{ display: "block" }} />
    </div>
  );
}
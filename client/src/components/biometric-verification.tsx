import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCheck, Play, Settings, Eye, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { startCamera as importedStartCamera, stopCamera, captureFrame } from "@/lib/camera";
import { detectLiveness } from "@/lib/face-detection";
import { loadFaceApiModels } from "@/lib/face-api-loader";
import { waitForBlink } from "@/lib/blink-detection";
import { waitForHeadTurn } from "@/lib/head-turn-detection";

interface BiometricVerificationProps {
  sessionId: string;
  onNext: () => void;
}

export default function BiometricVerification({ sessionId, onNext }: BiometricVerificationProps) {
  const [cameraStarted, setCameraStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState({
    facePresent: false,
    blinkDetected: false,
    headMovement: false,
    instructions: [
      "Please position your face in the frame",
      "Blink twice when prompted",
      "Slowly turn your head left and right"
    ]
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionInterval = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const verifyBiometricMutation = useMutation({
    mutationFn: async (data: { faceImageData: string; livenessData: any }) => {
      const response = await apiRequest("POST", `/api/verification/${sessionId}/biometric`, data);
      return response.json();
    },
    onSuccess: (data: { success: boolean; faceMatchScore?: number }) => {
      if (data.success) {
        toast({
          title: "Biometric verification successful",
          description: `Face match: ${data.faceMatchScore}% confidence`,
        });
        onNext();
      } else {
        toast({
          title: "Verification failed",
          description: "Please try the biometric verification again",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Verification error",
        description: "Failed to process biometric data. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Load face-api models when component mounts
  useEffect(() => {
    const init = async () => {
      try {
        console.log('Loading face-api models...');
        await loadFaceApiModels();
        console.log('Face-api models loaded successfully');
      } catch (error) {
        console.error('Failed to load models:', error);
        toast({
          title: "Error",
          description: "Failed to load face detection. Please refresh the page.",
          variant: "destructive",
        });
      }
    };
    
    init();

    return () => {
      console.log('Cleaning up...');
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
      stopCamera();
      resetLivenessDetection();
    };
  }, [toast]);

  const startVerification = async () => {
    if (!videoRef.current) {
      console.error('Video ref is not attached');
      toast({
        title: "Error",
        description: "Video element not available. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Initializing camera...');
      await initializeCamera(videoRef.current, { width: 320, height: 240 });
      console.log('Camera initialized, starting face detection...');
      
      // Add a small delay to ensure the video is playing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCameraStarted(true);

      // Start detection loop
      detectionInterval.current = setInterval(async () => {
        if (!videoRef.current) return;

        try {
          console.log('Running face detection...');
          const result = await detectLiveness(videoRef.current);
          console.log('Detection result:', result);

          setLivenessStatus(prev => ({
            ...prev,
            facePresent: result.facePresent,
            blinkDetected: result.blinkDetected,
            headMovement: result.headMovement
          }));

          if (result.facePresent) {
            console.log('Face detected!');
          } else {
            console.log('No face detected');
          }

          if (result.blinkDetected && result.headMovement) {
            console.log('Liveness check passed!');
            clearInterval(detectionInterval.current!);
            handleVerificationComplete();
          }
        } catch (error) {
          console.error('Error in detection loop:', error);
        }
      }, 500);
    } catch (error) {
      console.error('Camera initialization error:', error);
      toast({
        title: "Camera Error",
        description: "Could not access the camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const handleVerificationComplete = async () => {
    if (!videoRef.current) return;
    
    setIsProcessing(true);
    
    try {
      const imageData = captureFrame(videoRef.current);
      await verifyBiometricMutation.mutateAsync({
        faceImageData: imageData,
        livenessData: {
          blinkDetected: livenessStatus.blinkDetected,
          headMovement: livenessStatus.headMovement,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "An error occurred during verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetLivenessDetection = () => {
    setLivenessStatus({
      facePresent: false,
      blinkDetected: false,
      headMovement: false,
      instructions: [
        "Please position your face in the frame",
        "Blink twice when prompted",
        "Slowly turn your head left and right"
      ]
    });
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-4">Biometric Verification</h2>
      
      <div className="relative w-full max-w-md mb-4 rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full h-auto"
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }} // Mirror the video
        />
        {!cameraStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <p className="text-white">Camera not started</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${livenessStatus.facePresent ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span>Face detected</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${livenessStatus.blinkDetected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span>Blink detected</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${livenessStatus.headMovement ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span>Head movement detected</span>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-md">
          <h3 className="font-medium text-blue-800">Instructions:</h3>
          <ol className="list-decimal pl-5 mt-1 space-y-1 text-sm text-blue-700">
            {livenessStatus.instructions.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </div>

        <Button
          onClick={startVerification}
          disabled={cameraStarted || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto mb-2"></div>
          ) : cameraStarted ? (
            'Verification in progress...'
          ) : (
            'Start Verification'
          )}
        </Button>
      </div>
    </div>
  );
}

// Use initializeCamera as your local helper
async function initializeCamera(
  videoElement: HTMLVideoElement | null,
  options?: string | { width: number; height: number }
): Promise<void> {
  if (!videoElement) return;

  const constraints: MediaStreamConstraints = {
    video: {
      ...(typeof options === 'string'
        ? { deviceId: { exact: options } }
        : options || { width: { ideal: 1280 }, height: { ideal: 720 } }),
      facingMode: 'user'
    },
    audio: false
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = stream;
  videoElement.play();
}

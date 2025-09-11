import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCheck, Play, Settings, Eye, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { startCamera, stopCamera, captureFrame } from "@/lib/camera";
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
  const [currentInstruction, setCurrentInstruction] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([false, false, false]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const instructions = [
    "Look directly at the camera",
    "Blink twice when prompted",
    "Turn head left and right"
  ];

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

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleCanPlay = () => {
      setIsVideoReady(true);
    };

    videoElement.addEventListener('canplay', handleCanPlay);
    
    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay);
      stopCamera();
    };
  }, []);

  const startVerification = async () => {
    const videoElement = videoRef.current;
    
    if (!videoElement) {
      toast({
        title: "Camera Error",
        description: "Video element is not available. Please try refreshing the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCameraStarted(true);
      setIsVideoReady(false);
      
      // Ensure the video element is visible and properly sized
      videoElement.style.display = 'block';
      videoElement.style.width = '100%';
      videoElement.style.height = 'auto';
      
      // Start camera with error handling
      try {
        await startCamera(videoElement);
      } catch (error) {
        console.error('Camera initialization error:', error);
        throw error;
      }

      // Wait for video to be ready to play
      await new Promise<void>((resolve, reject) => {
        if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          resolve();
          return;
        }

        const onCanPlay = () => {
          cleanup();
          resolve();
        };

        const onError = (e: Event) => {
          cleanup();
          reject(new Error('Video playback error'));
        };

        const cleanup = () => {
          videoElement.removeEventListener('canplay', onCanPlay);
          videoElement.removeEventListener('error', onError);
          clearTimeout(timeout);
        };

        videoElement.addEventListener('canplay', onCanPlay, { once: true });
        videoElement.addEventListener('error', onError, { once: true });
        
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Video playback timed out'));
        }, 5000);
      });
      
      // Start liveness detection sequence after a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      await performLivenessCheck();
      
    } catch (error) {
      console.error('Verification error:', error);
      setCameraStarted(false);
      stopCamera();
      
      let errorMessage = 'Failed to access camera. Please check permissions and try again.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access was denied. Please allow camera access to continue.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.message.includes('Video element')) {
          errorMessage = 'Video element is not available. Please refresh the page and try again.';
        } else if (error.message.includes('timed out')) {
          errorMessage = 'Camera is taking too long to start. Please try again.';
        }
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const performLivenessCheck = async () => {
    if (!videoRef.current) {
      toast({
        title: "Verification Error",
        description: "Video element is not available",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      await loadFaceApiModels();

      // Step 1: Look directly at the camera
      setCurrentInstruction(0);
      await new Promise(resolve => setTimeout(resolve, 1000));
      let faceImageData = captureFrame(videoRef.current);
      if (!faceImageData || faceImageData === 'data:,') throw new Error('Failed to capture frame from camera');
      let livenessData = await detectLiveness(videoRef.current);
      setCompletedSteps([true, false, false]);

      // Step 2: Blink twice
      setCurrentInstruction(1);
      toast({ title: "Blink twice", description: "Please blink twice for the camera." });
      const blinked = await waitForBlink(videoRef.current, 2, 8000);
      if (!blinked) throw new Error('Blink not detected');
      setCompletedSteps([true, true, false]);

      // Step 3: Turn head left and right
      setCurrentInstruction(2);
      toast({ title: "Turn head", description: "Please turn your head left and right." });
      const turned = await waitForHeadTurn(videoRef.current, 8000);
      if (!turned) throw new Error('Head turn not detected');
      setCompletedSteps([true, true, true]);

      // Submit after all steps
      verifyBiometricMutation.mutate({
        faceImageData,
        livenessData
      });

    } catch (error) {
      console.error('Liveness check error:', error);
      
      let errorMessage = 'Could not complete liveness detection. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.message.includes('face') || error.message.includes('detect')) {
          errorMessage = 'Could not detect face. Please ensure your face is clearly visible.';
        } else if (error.message.includes('frame')) {
          errorMessage = 'Failed to capture image. Please try again.';
        }
      }
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Stop camera on error to reset the state
      stopCamera();
      setCameraStarted(false);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="p-8" data-testid="biometric-verification-card">
      <CardContent>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="text-purple-600 text-2xl h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-biometric-title">
            Biometric Verification
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-biometric-description">
            We'll now verify that you are the person in the ID document using liveness detection.
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-6">
          {/* Camera Preview */}
          <div className="camera-preview rounded-xl p-8 text-center" data-testid="camera-preview">
            <div className="relative inline-block">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ display: cameraStarted ? "block" : "none" }}
                className="w-64 h-80 bg-muted/30 rounded-2xl object-cover"
                data-testid="video-camera-feed"
              />
              {!cameraStarted && (
                <div className="absolute inset-0 w-64 h-80 bg-muted/30 rounded-2xl border-4 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🎥</div>
                    <p className="text-muted-foreground" data-testid="text-camera-placeholder">Camera Preview</p>
                    <p className="text-xs text-muted-foreground mt-2">Position your face in the frame</p>
                  </div>
                </div>
              )}
              {cameraStarted && isProcessing && (
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>Processing...</p>
                  </div>
                </div>
              )}
              {cameraStarted && (
                <div className="absolute inset-0 rounded-2xl border-4 border-primary/30 pulse-ring"></div>
              )}
            </div>
          </div>

          {/* Liveness Instructions */}
          <Alert className="border-blue-200 bg-blue-50">
            <Eye className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800" data-testid="text-liveness-instructions">
              <h3 className="font-medium mb-3">Liveness Detection Steps</h3>
              <div className="space-y-3">
                {instructions.map((instruction, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      completedSteps[index] ? 'bg-green-600 text-white' : index === currentInstruction ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <span className={
                      completedSteps[index]
                        ? 'text-green-800'
                        : index === currentInstruction
                        ? 'text-blue-800'
                        : 'text-muted-foreground'
                    }>
                      {instruction}
                    </span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>

          {/* Camera Controls */}
          <div className="flex justify-center space-x-4">
            <Button 
              onClick={startVerification}
              disabled={cameraStarted || verifyBiometricMutation.isPending}
              className="px-6 py-3"
              data-testid="button-start-liveness"
            >
              {cameraStarted ? (
                <>Processing...</>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Verification
                </>
              )}
            </Button>
            
            <Button 
              variant="secondary" 
              className="px-6 py-3"
              data-testid="button-camera-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Camera Settings
            </Button>
          </div>

          {/* Privacy Notice */}
          <div className="text-center text-xs text-muted-foreground" data-testid="text-privacy-notice">
            <Lock className="inline h-3 w-3 mr-1" />
            Your biometric data is processed locally and immediately deleted after verification
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

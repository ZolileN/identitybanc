import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCheck, Play, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { startCamera, stopCamera, captureFrame } from "@/lib/camera";
import { detectLiveness, loadModels, resetLivenessDetection } from "@/lib/face-detection";

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
      "Position your face in the frame",
      "Blink a few times",
      "Slowly turn your head left and right"
    ]
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionInterval = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Load models when component mounts
  useEffect(() => {
    const init = async () => {
      try {
        console.log('Initializing face detection models...');
        await loadModels();
        console.log('Face detection models loaded');
      } catch (error) {
        console.error('Failed to load models:', error);
        toast({
          title: "Error",
          description: "Failed to initialize face detection. Please refresh the page.",
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
      console.log('Starting camera...');
      await startCamera(videoRef.current);
      console.log('Camera started, beginning face detection...');
      
      // Add a small delay to ensure the video is playing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCameraStarted(true);

      // Start detection loop
      detectionInterval.current = setInterval(async () => {
        if (!videoRef.current) return;

        try {
          const result = await detectLiveness(videoRef.current);
          
          setLivenessStatus(prev => ({
            ...prev,
            facePresent: result.facePresent,
            blinkDetected: result.blinkDetected,
            headMovement: result.headMovement
          }));

          // Check if verification is complete
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
      console.error('Camera error:', error);
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
      // Capture the final frame
      const imageData = captureFrame(videoRef.current);
      
      // In a real app, you would send this to your backend for verification
      console.log('Verification complete, captured frame:', imageData.substring(0, 50) + '...');
      
      // Mock API call - replace with your actual API call
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

  return (
    <Card className="p-8">
      <CardContent>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="text-purple-600 text-2xl h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Biometric Verification
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We'll now verify that you are a real person using liveness detection.
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-6">
          {/* Camera Preview */}
          <div className="camera-preview rounded-xl p-8 text-center">
            <div className="relative inline-block">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full max-w-md rounded-lg"
                style={{ transform: 'scaleX(-1)' }}
              />
              {!cameraStarted && (
                <div className="absolute inset-0 w-full h-full bg-muted/30 rounded-lg border-4 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🎥</div>
                    <p className="text-muted-foreground">Camera Preview</p>
                    <p className="text-xs text-muted-foreground mt-2">Position your face in the frame</p>
                  </div>
                </div>
              )}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="text-white text-center">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                    <p>Processing...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Liveness Status */}
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              <h3 className="font-medium mb-3">Liveness Detection Status</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    livenessStatus.facePresent ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <span>Face detected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    livenessStatus.blinkDetected ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <span>Blink detected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    livenessStatus.headMovement ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <span>Head movement detected</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Instructions */}
          <Alert className="border-purple-200 bg-purple-50">
            <AlertDescription className="text-purple-800">
              <h3 className="font-medium mb-2">Instructions:</h3>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                {livenessStatus.instructions.map((instruction, index) => (
                  <li key={index} className="text-purple-700">{instruction}</li>
                ))}
              </ol>
            </AlertDescription>
          </Alert>

          {/* Start Button */}
          <Button 
            onClick={startVerification}
            disabled={cameraStarted || isProcessing}
            className="w-full py-6 text-lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : cameraStarted ? (
              'Verification in progress...'
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Start Verification
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

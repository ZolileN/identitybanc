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
        await loadFaceApiModels();
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
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      stopCamera();
      resetLivenessDetection();
    };
  }, []);

  const startVerification = async () => {
    if (!videoRef.current) return;

    try {
      await startCamera(videoRef.current);
      setCameraStarted(true);
      
      // Start liveness detection
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

          // Auto-proceed when liveness is detected
          if (result.blinkDetected && result.headMovement) {
            handleVerificationComplete();
          }
        } catch (error) {
          console.error('Liveness detection error:', error);
        }
      }, 300);

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
                {livenessStatus.instructions.map((instruction, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 && livenessStatus.facePresent ? 'bg-green-600 text-white' : index === 1 && livenessStatus.blinkDetected ? 'bg-green-600 text-white' : index === 2 && livenessStatus.headMovement ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <span className={
                      index === 0 && livenessStatus.facePresent
                        ? 'text-green-800'
                        : index === 1 && livenessStatus.blinkDetected
                        ? 'text-green-800'
                        : index === 2 && livenessStatus.headMovement
                        ? 'text-green-800'
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

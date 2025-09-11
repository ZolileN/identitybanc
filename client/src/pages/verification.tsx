import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";
import Footer from "@/components/footer";
import ProgressStepper from "@/components/progress-stepper";
import LinkGeneration from "@/components/link-generation";
import IdUpload from "@/components/id-upload";
import BiometricVerification from "@/components/biometric-verification";
import VerificationComplete from "@/components/verification-complete";

type VerificationStep = 'link' | 'id_upload' | 'biometric' | 'complete';

export default function Verification() {
  const [match, params] = useRoute("/verification/:linkId?");
  const [currentStep, setCurrentStep] = useState<VerificationStep>('link');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAccessingLink, setIsAccessingLink] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const { toast } = useToast();

  // Storage keys for localStorage
  const STORAGE_KEY_SESSION_ID = 'verification_session_id';
  const STORAGE_KEY_CURRENT_STEP = 'verification_current_step';

  const accessLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const response = await apiRequest("POST", `/api/verification/${linkId}/access`, {});
      return response.json();
    },
    onSuccess: (data: { session: { id: string } }) => {
      const newSessionId = data.session.id;
      setSessionId(newSessionId);
      setCurrentStep('id_upload');
      setIsAccessingLink(false);
      
      // Store session data in localStorage for persistence across refreshes
      localStorage.setItem(STORAGE_KEY_SESSION_ID, newSessionId);
      localStorage.setItem(STORAGE_KEY_CURRENT_STEP, 'id_upload');
      
      toast({
        title: "Link accessed successfully",
        description: "You can now proceed with verification",
      });
    },
    onError: (error: any) => {
      setIsAccessingLink(false);
      
      // Handle specific error cases with better messaging
      let errorMessage = "The verification link is invalid or has expired";
      let showRecoveryOption = false;
      
      if (error.message?.includes('409') || error.message?.includes('already been used')) {
        // Check if we have a stored session for this verification
        const storedSessionId = localStorage.getItem(STORAGE_KEY_SESSION_ID);
        if (storedSessionId) {
          errorMessage = "This link has already been accessed. Resuming your verification session...";
          setSessionId(storedSessionId);
          const storedStep = localStorage.getItem(STORAGE_KEY_CURRENT_STEP) as VerificationStep || 'id_upload';
          setCurrentStep(storedStep);
          showRecoveryOption = true;
        } else {
          errorMessage = "This verification link has already been used. Please request a new verification link.";
        }
      } else if (error.message?.includes('410') || error.message?.includes('expired')) {
        errorMessage = "This verification link has expired. Please request a new verification link.";
        // Clear any stored session data
        localStorage.removeItem(STORAGE_KEY_SESSION_ID);
        localStorage.removeItem(STORAGE_KEY_CURRENT_STEP);
      }
      
      if (!showRecoveryOption) {
        toast({
          title: "Link access failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Session recovered",
          description: errorMessage,
        });
      }
    },
  });

  // Restore session from localStorage on component mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem(STORAGE_KEY_SESSION_ID);
    const storedStep = localStorage.getItem(STORAGE_KEY_CURRENT_STEP) as VerificationStep;
    
    if (storedSessionId && storedStep && !sessionId) {
      setIsRestoringSession(true);
      // Verify the stored session is still valid
      fetch(`/api/verification/${storedSessionId}`)
        .then(response => {
          if (response.ok) {
            setSessionId(storedSessionId);
            setCurrentStep(storedStep);
            toast({
              title: "Session restored",
              description: "Your verification session has been restored",
            });
          } else {
            // Session is invalid, clear localStorage
            localStorage.removeItem(STORAGE_KEY_SESSION_ID);
            localStorage.removeItem(STORAGE_KEY_CURRENT_STEP);
          }
        })
        .catch(() => {
          // Network error or session invalid, clear localStorage
          localStorage.removeItem(STORAGE_KEY_SESSION_ID);
          localStorage.removeItem(STORAGE_KEY_CURRENT_STEP);
        })
        .finally(() => {
          setIsRestoringSession(false);
        });
    }
  }, []);

  // Handle linkId access when component mounts or linkId changes
  useEffect(() => {
    const linkId = params?.linkId;
    if (linkId && !sessionId && !isAccessingLink && !isRestoringSession) {
      setIsAccessingLink(true);
      accessLinkMutation.mutate(linkId);
    }
  }, [params?.linkId, sessionId, isAccessingLink, isRestoringSession]);

  const steps = [
    { id: 'link', label: 'Generate Link', icon: 'link' },
    { id: 'id_upload', label: 'ID Upload', icon: 'id-card' },
    { id: 'biometric', label: 'Biometric', icon: 'camera' },
    { id: 'complete', label: 'Complete', icon: 'check-circle' }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-8 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          
          <ProgressStepper 
            steps={steps} 
            currentStep={currentStepIndex} 
            data-testid="progress-stepper"
          />

          <div className="mt-8 fade-in">
            {isAccessingLink && (
              <div className="text-center py-8" data-testid="link-accessing-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Accessing verification link...</p>
              </div>
            )}

            {isRestoringSession && (
              <div className="text-center py-8" data-testid="session-restoring-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Restoring your verification session...</p>
              </div>
            )}

            {!isAccessingLink && !isRestoringSession && currentStep === 'link' && (
              <LinkGeneration 
                onNext={(newSessionId) => {
                  setSessionId(newSessionId);
                  setCurrentStep('id_upload');
                  localStorage.setItem(STORAGE_KEY_SESSION_ID, newSessionId);
                  localStorage.setItem(STORAGE_KEY_CURRENT_STEP, 'id_upload');
                }}
                sessionId={sessionId}
                data-testid="link-generation-section"
              />
            )}

            {!isAccessingLink && !isRestoringSession && currentStep === 'id_upload' && sessionId && (
              <IdUpload 
                sessionId={sessionId}
                onNext={() => {
                  setCurrentStep('biometric');
                  localStorage.setItem(STORAGE_KEY_CURRENT_STEP, 'biometric');
                }}
                data-testid="id-upload-section"
              />
            )}

            {!isAccessingLink && !isRestoringSession && currentStep === 'biometric' && sessionId && (
              <BiometricVerification 
                sessionId={sessionId}
                onNext={() => {
                  setCurrentStep('complete');
                  localStorage.setItem(STORAGE_KEY_CURRENT_STEP, 'complete');
                }}
                data-testid="biometric-verification-section"
              />
            )}

            {!isAccessingLink && !isRestoringSession && currentStep === 'complete' && sessionId && (
              <VerificationComplete 
                sessionId={sessionId}
                onRestart={() => {
                  setCurrentStep('link');
                  setSessionId(null);
                  // Clear localStorage when restarting
                  localStorage.removeItem(STORAGE_KEY_SESSION_ID);
                  localStorage.removeItem(STORAGE_KEY_CURRENT_STEP);
                }}
                data-testid="verification-complete-section"
              />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

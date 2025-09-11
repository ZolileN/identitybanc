import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Link, Share2, Copy, MessageCircle, Shield, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LinkGenerationProps {
  onNext: (sessionId: string) => void;
  sessionId: string | null;
}

export default function LinkGeneration({ onNext, sessionId }: LinkGenerationProps) {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId);
  const { toast } = useToast();

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/verification/generate-link", {});
      return response.json();
    },
    onSuccess: (data: { verificationLink: string; sessionId: string }) => {
      setGeneratedLink(data.verificationLink);
      setCurrentSessionId(data.sessionId);
      toast({
        title: "Verification link generated",
        description: "Your unique verification link is ready to share",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate verification link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "The verification link has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const shareViaWhatsApp = () => {
    if (!generatedLink) return;
    const message = `Please complete your identity verification using this secure link: ${generatedLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareViaTwitter = () => {
    if (!generatedLink) return;
    const message = `Identity verification link: ${generatedLink}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareViaEmail = () => {
    if (!generatedLink) return;
    const subject = "Identity Verification Required";
    const body = `Please complete your identity verification using this secure link: ${generatedLink}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const proceedToNextStep = () => {
    if (currentSessionId) {
      onNext(currentSessionId);
    }
  };

  return (
    <Card className="p-8" data-testid="link-generation-card">
      <CardContent>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Link className="text-primary text-2xl h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-link-title">
            Generate Verification Link
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-link-description">
            Create a secure verification link that you can share via social media, messaging apps, or email.
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {!generatedLink ? (
            <div className="text-center">
              <Button 
                onClick={() => generateLinkMutation.mutate()}
                disabled={generateLinkMutation.isPending}
                className="px-8 py-6 text-lg"
                data-testid="button-generate-link"
              >
                {generateLinkMutation.isPending ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Link className="mr-2 h-5 w-5" />
                    Generate Verification Link
                  </>
                )}
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">
                Click to create your unique verification link
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Generated Link Display */}
              <div className="bg-muted/30 rounded-lg p-6" data-testid="generated-link-display">
                <h3 className="font-medium text-foreground mb-3">Your Verification Link</h3>
                <div className="flex items-center space-x-2 p-3 bg-background border rounded-lg">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="flex-1 text-sm"
                    data-testid="input-generated-link"
                  />
                  <Button
                    onClick={() => copyToClipboard(generatedLink)}
                    variant="outline"
                    size="sm"
                    data-testid="button-copy-link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Sharing Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="sharing-options">
                <Button
                  onClick={shareViaWhatsApp}
                  variant="outline"
                  className="h-16 flex-col space-y-2"
                  data-testid="button-share-whatsapp"
                >
                  <MessageCircle className="h-6 w-6 text-green-600" />
                  <span>Share via WhatsApp</span>
                </Button>

                <Button
                  onClick={shareViaEmail}
                  variant="outline"
                  className="h-16 flex-col space-y-2"
                  data-testid="button-share-email"
                >
                  <Share2 className="h-6 w-6 text-blue-600" />
                  <span>Share via Email</span>
                </Button>

                <Button
                  onClick={shareViaTwitter}
                  variant="outline"
                  className="h-16 flex-col space-y-2"
                  data-testid="button-share-twitter"
                >
                  <ExternalLink className="h-6 w-6 text-sky-600" />
                  <span>Share via Twitter</span>
                </Button>
              </div>

              {/* Open Link Button */}
              <div className="text-center">
                <Button
                  onClick={() => window.open(generatedLink, '_blank')}
                  className="px-8 py-6 text-lg"
                  data-testid="button-open-verification-link"
                >
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Open Verification Link
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Click to open the verification link in a new tab
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <Alert className="mt-6 border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800" data-testid="text-security-notice">
            <strong>Your data is secure:</strong> The verification link is unique and expires after use. All information is encrypted and processed in compliance with POPIA and GDPR regulations.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

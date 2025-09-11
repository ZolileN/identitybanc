import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Download, Share, RotateCcw, IdCard, UserCheck, Shield, ArrowRight } from "lucide-react";
import { VerificationSession } from "@shared/schema";

interface VerificationCompleteProps {
  sessionId: string;
  onRestart: () => void;
}

export default function VerificationComplete({ sessionId, onRestart }: VerificationCompleteProps) {
  const { data: session, isLoading } = useQuery<VerificationSession>({
    queryKey: ['/api/verification', sessionId],
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <Card className="p-8">
        <CardContent>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading verification results...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="p-8">
        <CardContent>
          <div className="text-center text-destructive">
            <p>Failed to load verification session</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('en-ZA', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Johannesburg'
    });
  };

  return (
    <Card className="p-8" data-testid="verification-complete-card">
      <CardContent>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-success text-3xl h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-complete-title">
            Verification Complete!
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-complete-description">
            Your identity has been successfully verified and is now ready for use with our partner institutions.
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Verification Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center" data-testid="result-id-validated">
              <IdCard className="text-green-600 h-8 w-8 mb-2 mx-auto" />
              <h3 className="font-medium text-green-900">ID Validated</h3>
              <p className="text-sm text-green-700">DHA database confirmed</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center" data-testid="result-face-matched">
              <UserCheck className="text-green-600 h-8 w-8 mb-2 mx-auto" />
              <h3 className="font-medium text-green-900">Face Matched</h3>
              <p className="text-sm text-green-700">{session.faceMatchScore}% confidence</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center" data-testid="result-fraud-check">
              <Shield className="text-green-600 h-8 w-8 mb-2 mx-auto" />
              <h3 className="font-medium text-green-900">Fraud Check</h3>
              <p className="text-sm text-green-700">No issues detected</p>
            </div>
          </div>

          {/* Verification Details */}
          <div className="bg-muted/30 rounded-lg p-6" data-testid="verification-summary">
            <h3 className="font-medium text-foreground mb-4">Verification Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Verification ID:</span>
                <span className="font-mono ml-2" data-testid="text-verification-id">{session.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-2" data-testid="text-completion-date">
                  {session.completedAt ? formatDate(session.completedAt) : 'In Progress'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Valid Until:</span>
                <span className="ml-2" data-testid="text-valid-until">
                  {session.completedAt 
                    ? formatDate(new Date(new Date(session.completedAt).getTime() + 90 * 24 * 60 * 60 * 1000))
                    : 'N/A'
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Compliance:</span>
                <span className="ml-2 text-success" data-testid="text-compliance-status">POPIA Compliant</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800" data-testid="text-next-steps">
              <h3 className="font-medium text-blue-900 mb-3">What's Next?</h3>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <ArrowRight className="text-blue-600 mr-2 h-4 w-4" />
                  Your verification is now available to authorized partners
                </li>
                <li className="flex items-center">
                  <ArrowRight className="text-blue-600 mr-2 h-4 w-4" />
                  You'll receive email confirmation with verification details
                </li>
                <li className="flex items-center">
                  <ArrowRight className="text-blue-600 mr-2 h-4 w-4" />
                  No further action required - the process is complete
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              className="px-6 py-3"
              data-testid="button-download-certificate"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Certificate
            </Button>
            
            <Button 
              variant="secondary" 
              className="px-6 py-3"
              data-testid="button-share-verification"
            >
              <Share className="mr-2 h-4 w-4" />
              Share Verification
            </Button>
            
            <Button 
              variant="ghost" 
              className="px-6 py-3"
              onClick={onRestart}
              data-testid="button-start-new-verification"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Start New Verification
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

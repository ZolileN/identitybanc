import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IdCard, CloudUpload, FileImage, Trash2, Lightbulb, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const idUploadSchema = z.object({
  idType: z.enum(["book", "card"]),
  file: z.instanceof(File).optional(),
});

type IdUploadData = z.infer<typeof idUploadSchema>;

interface IdUploadProps {
  sessionId: string;
  onNext: () => void;
}

export default function IdUpload({ sessionId, onNext }: IdUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const form = useForm<IdUploadData>({
    resolver: zodResolver(idUploadSchema),
    defaultValues: {
      idType: "book",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { idType: string; file: File }) => {
      const formData = new FormData();
      formData.append('idDocument', data.file);
      formData.append('idType', data.idType);

      const response = await fetch(`/api/verification/${sessionId}/upload-id`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "ID document validated",
        description: "Your ID document has been successfully validated against the DHA database",
      });
      onNext();
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to process your ID document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.match(/^image\/(jpeg|jpg|png|pdf)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or PDF file",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    form.setValue("file", file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const onSubmit = (data: IdUploadData) => {
    if (!uploadedFile) {
      toast({
        title: "No file selected",
        description: "Please upload your ID document first",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      idType: data.idType,
      file: uploadedFile,
    });
  };

  return (
    <Card className="p-8" data-testid="id-upload-card">
      <CardContent>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <IdCard className="text-success text-2xl h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-id-title">
            Upload Your SA ID Document
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-id-description">
            Please upload a clear photo of your South African ID book or smart card. We'll validate it against the DHA database.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-6">
          {/* ID Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RadioGroup
              {...form.register("idType")}
              defaultValue="book"
              onValueChange={(value) => form.setValue("idType", value as "book" | "card")}
              data-testid="radio-group-id-type"
            >
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  form.watch("idType") === "book" ? "border-primary bg-primary/5" : "border-input hover:border-primary"
                }`}
                onClick={() => form.setValue("idType", "book")}
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="book" id="book" data-testid="radio-id-book" />
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">SA ID Book</h3>
                    <p className="text-sm text-muted-foreground">Green booklet with photo page</p>
                  </div>
                  <span className="text-green-600 text-xl">📖</span>
                </div>
              </div>
              
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  form.watch("idType") === "card" ? "border-primary bg-primary/5" : "border-input hover:border-primary"
                }`}
                onClick={() => form.setValue("idType", "card")}
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="card" id="card" data-testid="radio-id-card" />
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">Smart ID Card</h3>
                    <p className="text-sm text-muted-foreground">Plastic card format</p>
                  </div>
                  <span className="text-blue-600 text-xl">💳</span>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Upload Zone */}
          <div 
            className={`upload-zone rounded-xl p-8 text-center cursor-pointer ${dragOver ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('id-upload')?.click()}
            data-testid="upload-zone"
          >
            <div className="max-w-sm mx-auto">
              <CloudUpload className="h-16 w-16 text-muted-foreground mb-4 mx-auto" />
              <h3 className="text-lg font-medium text-foreground mb-2">Drop your ID document here</h3>
              <p className="text-sm text-muted-foreground mb-4">or click to browse your device</p>
              <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
                <span>📱 JPG</span>
                <span>📱 PNG</span>
                <span>📱 PDF</span>
                <span>Max 10MB</span>
              </div>
            </div>
            <input 
              type="file" 
              id="id-upload" 
              className="hidden" 
              accept="image/*,.pdf"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              data-testid="input-file-upload"
            />
          </div>

          {/* Upload Guidelines */}
          <Alert className="border-amber-200 bg-amber-50">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800" data-testid="text-upload-guidelines">
              <strong>Photo Guidelines:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Ensure all text is clearly readable</li>
                <li>• Avoid shadows, glare, or blurred areas</li>
                <li>• Capture the entire document within the frame</li>
                <li>• Use good lighting for best results</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Uploaded File Preview */}
          {uploadedFile && (
            <div className="border border-border rounded-lg p-4" data-testid="upload-preview">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileImage className="text-primary h-6 w-6" />
                  <div>
                    <p className="font-medium text-foreground" data-testid="text-file-name">
                      {uploadedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-file-size">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB • Uploaded
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-success" data-testid="text-file-valid">✓ Valid format</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUploadedFile(null);
                      form.setValue("file", undefined);
                    }}
                    data-testid="button-remove-file"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={uploadMutation.isPending || !uploadedFile}
            data-testid="button-validate-id"
          >
            {uploadMutation.isPending ? (
              "Validating..."
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Validate ID Document
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

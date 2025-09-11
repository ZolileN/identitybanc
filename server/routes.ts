import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertVerificationSessionSchema, 
  updateVerificationSessionSchema,
  idUploadRequestSchema,
  biometricRequestSchema
} from "@shared/schema";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Generate verification link
  app.post("/api/verification/generate-link", async (req, res) => {
    try {
      // Generate a unique verification link
      const linkId = crypto.randomBytes(32).toString('hex');
      const verificationLink = `${req.protocol}://${req.get('host')}/verification/${linkId}`;
      
      // Link expires in 24 hours
      const linkExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const session = await storage.createVerificationSession({ 
        verificationLink,
        linkId,
        linkExpiry
      });

      res.json({ 
        sessionId: session.id, 
        verificationLink: session.verificationLink,
        linkId 
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to generate verification link" });
    }
  });

  // Access verification link
  app.post("/api/verification/:linkId/access", async (req, res) => {
    try {
      const { linkId } = req.params;

      const session = await storage.getVerificationSessionByLinkId(linkId);
      if (!session) {
        return res.status(404).json({ error: "Verification link not found" });
      }

      // Check if link has expired
      if (new Date() > session.linkExpiry) {
        return res.status(410).json({ error: "Verification link has expired" });
      }

      // Check if link has already been used (one-time use)
      if (session.linkUsed) {
        return res.status(409).json({ error: "Verification link has already been used" });
      }

      // Mark link as accessed, used, and update status
      const updatedSession = await storage.updateVerificationSession(session.id, {
        linkAccessed: true,
        linkUsed: true,
        accessedAt: new Date(),
        status: 'id_upload'
      });

      res.json({ success: true, session: updatedSession });
    } catch (error) {
      res.status(400).json({ error: "Link access failed" });
    }
  });

  // Upload ID document
  app.post("/api/verification/:sessionId/upload-id", upload.single('idDocument'), async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Validate request body
      const validationResult = idUploadRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }
      
      const { idType } = validationResult.data;

      const session = await storage.getVerificationSession(sessionId);
      if (!session || !session.linkAccessed) {
        return res.status(400).json({ error: "Verification link must be accessed first" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Process and validate the uploaded image
      const processedImagePath = await processIDDocument(req.file.path, idType);
      
      // Mock ID validation against DHA database
      const idData = await validateIDDocument(processedImagePath, idType);
      
      const updatedSession = await storage.updateVerificationSession(sessionId, {
        idDocumentType: idType,
        idDocumentPath: processedImagePath,
        idDocumentData: idData,
        idValidated: true,
        status: 'biometric'
      });

      res.json({ success: true, session: updatedSession, idData });
    } catch (error) {
      res.status(400).json({ error: "ID document processing failed" });
    }
  });

  // Submit biometric verification
  app.post("/api/verification/:sessionId/biometric", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Validate request body
      const validationResult = biometricRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }
      
      const { faceImageData, livenessData } = validationResult.data;

      const session = await storage.getVerificationSession(sessionId);
      if (!session || !session.idValidated) {
        return res.status(400).json({ error: "ID validation required first" });
      }

      // Mock face comparison and liveness detection
      const faceMatchScore = Math.floor(85 + Math.random() * 15); // 85-100%
      const livenessScore = Math.floor(90 + Math.random() * 10); // 90-100%
      const fraudCheckPassed = faceMatchScore > 80 && livenessScore > 85;

      const updatedSession = await storage.updateVerificationSession(sessionId, {
        biometricData: { faceImageData, livenessData },
        faceMatchScore,
        livenessScore,
        fraudCheckPassed,
        verificationComplete: fraudCheckPassed,
        status: fraudCheckPassed ? 'complete' : 'failed',
        completedAt: fraudCheckPassed ? new Date() : null
      });

      res.json({ 
        success: fraudCheckPassed, 
        session: updatedSession,
        faceMatchScore,
        livenessScore
      });
    } catch (error) {
      res.status(400).json({ error: "Biometric verification failed" });
    }
  });

  // Get verification session
  app.get("/api/verification/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getVerificationSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Verification session not found" });
      }

      res.json(session);
    } catch (error) {
      res.status(400).json({ error: "Failed to retrieve verification session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions
async function processIDDocument(filePath: string, idType: string) {
  try {
    const outputPath = path.join('uploads', `processed_${Date.now()}.jpg`);
    
    // Process image with Sharp - resize, optimize, extract text regions
    await sharp(filePath)
      .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    // Clean up original file
    fs.unlinkSync(filePath);
    
    return outputPath;
  } catch (error) {
    throw new Error("Failed to process ID document");
  }
}

async function validateIDDocument(imagePath: string, idType: string) {
  // Mock DHA database validation
  // In production, this would integrate with actual DHA APIs
  
  const mockIDData = {
    idNumber: "8001015009087",
    firstName: "John",
    lastName: "Doe", 
    dateOfBirth: "1980-01-01",
    citizenship: "SA",
    gender: "M",
    validDocument: true,
    dhaVerified: true,
    expiryDate: idType === 'card' ? "2034-01-01" : null
  };

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockIDData;
}

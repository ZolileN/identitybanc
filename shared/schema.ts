import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const verificationSessions = pgTable("verification_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verificationLink: text("verification_link").notNull(),
  linkId: text("link_id").notNull(), // The unique identifier in the URL
  linkExpiry: timestamp("link_expiry").notNull(), // When the link expires
  linkUsed: boolean("link_used").default(false), // One-time use enforcement
  linkAccessed: boolean("link_accessed").default(false),
  accessedAt: timestamp("accessed_at"),
  idDocumentType: text("id_document_type"), // 'book' | 'card'
  idDocumentPath: text("id_document_path"),
  idDocumentData: jsonb("id_document_data"), // extracted ID data
  idValidated: boolean("id_validated").default(false),
  biometricData: jsonb("biometric_data"), // face capture data
  faceMatchScore: integer("face_match_score"), // 0-100
  livenessScore: integer("liveness_score"), // 0-100
  fraudCheckPassed: boolean("fraud_check_passed").default(false),
  verificationComplete: boolean("verification_complete").default(false),
  status: text("status").default('link_generated'), // 'link_generated' | 'id_upload' | 'biometric' | 'complete' | 'failed'
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVerificationSessionSchema = createInsertSchema(verificationSessions).pick({
  verificationLink: true,
  linkId: true,
  linkExpiry: true,
});

export const updateVerificationSessionSchema = createInsertSchema(verificationSessions)
  .omit({ id: true, createdAt: true })
  .partial();

// Request body validation schemas
export const idUploadRequestSchema = z.object({
  idType: z.enum(['book', 'card']),
});

export const biometricRequestSchema = z.object({
  faceImageData: z.string().min(1, "Face image data is required"),
  livenessData: z.object({
    blinkDetected: z.boolean(),
    headMovement: z.boolean(),
    brightness: z.number().min(0).max(100),
  }),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type VerificationSession = typeof verificationSessions.$inferSelect;
export type InsertVerificationSession = z.infer<typeof insertVerificationSessionSchema>;
export type UpdateVerificationSession = z.infer<typeof updateVerificationSessionSchema>;
export type IdUploadRequest = z.infer<typeof idUploadRequestSchema>;
export type BiometricRequest = z.infer<typeof biometricRequestSchema>;

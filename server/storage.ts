import { type User, type InsertUser, type VerificationSession, type InsertVerificationSession, type UpdateVerificationSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createVerificationSession(session: InsertVerificationSession): Promise<VerificationSession>;
  getVerificationSession(id: string): Promise<VerificationSession | undefined>;
  updateVerificationSession(id: string, updates: UpdateVerificationSession): Promise<VerificationSession | undefined>;
  getVerificationSessionByLink(verificationLink: string): Promise<VerificationSession | undefined>;
  getVerificationSessionByLinkId(linkId: string): Promise<VerificationSession | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private verificationSessions: Map<string, VerificationSession>;

  constructor() {
    this.users = new Map();
    this.verificationSessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createVerificationSession(session: InsertVerificationSession): Promise<VerificationSession> {
    const id = randomUUID();
    const verificationSession: VerificationSession = {
      id,
      ...session,
      linkUsed: false,
      linkAccessed: false,
      accessedAt: null,
      idDocumentType: null,
      idDocumentPath: null,
      idDocumentData: null,
      idValidated: false,
      biometricData: null,
      faceMatchScore: null,
      livenessScore: null,
      fraudCheckPassed: false,
      verificationComplete: false,
      status: 'link_generated',
      createdAt: new Date(),
      completedAt: null,
    };
    this.verificationSessions.set(id, verificationSession);
    return verificationSession;
  }

  async getVerificationSession(id: string): Promise<VerificationSession | undefined> {
    return this.verificationSessions.get(id);
  }

  async updateVerificationSession(id: string, updates: UpdateVerificationSession): Promise<VerificationSession | undefined> {
    const existing = this.verificationSessions.get(id);
    if (!existing) return undefined;

    const updated: VerificationSession = {
      ...existing,
      ...updates,
    };
    this.verificationSessions.set(id, updated);
    return updated;
  }

  async getVerificationSessionByLink(verificationLink: string): Promise<VerificationSession | undefined> {
    return Array.from(this.verificationSessions.values()).find(
      (session) => session.verificationLink === verificationLink,
    );
  }

  async getVerificationSessionByLinkId(linkId: string): Promise<VerificationSession | undefined> {
    return Array.from(this.verificationSessions.values()).find(
      (session) => session.linkId === linkId,
    );
  }
}

export const storage = new MemStorage();

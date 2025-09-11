# Overview

This is a comprehensive South African identity verification platform that combines phone verification, document upload, and biometric authentication. The application implements POPIA-compliant identity verification with a three-step process: phone number verification via SMS/WhatsApp, ID document upload with OCR processing, and biometric face matching with liveness detection. Built as a full-stack web application, it provides both a user-facing verification interface and API endpoints for integration with banks, employers, and e-commerce platforms.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with **React 18** and **TypeScript**, using modern React patterns including hooks and functional components. The UI is constructed with **shadcn/ui** components based on **Radix UI** primitives, providing accessibility and consistent design patterns. **TailwindCSS** handles styling with a custom design system including CSS variables for theming. **React Query** manages server state and API interactions with optimistic updates and caching. Client-side routing is handled by **Wouter** for a lightweight routing solution. The frontend implements a multi-step verification wizard with camera integration for biometric capture and form validation using **React Hook Form** with **Zod** schemas.

## Backend Architecture  
The server is built with **Express.js** and **TypeScript** in ESM format. The architecture follows a RESTful API pattern with modular route organization. File uploads are handled through **Multer** with image processing via **Sharp**. The verification workflow is state-driven, tracking sessions through multiple verification steps (phone, document, biometric). The backend implements an in-memory storage abstraction that can be extended to database implementations. Session management includes verification code generation, document processing, and biometric score calculation.

## Data Storage
The application uses **Drizzle ORM** with **PostgreSQL** as the primary database, configured through environment variables. Database schemas define users and verification sessions with comprehensive tracking of verification states, document metadata, and biometric scores. The current implementation includes a memory-based storage adapter for development, with the database schema ready for production deployment. Migration management is handled through Drizzle Kit with schema versioning.

## Authentication and Verification Flow
The verification system implements a three-step process: phone verification with OTP codes, ID document upload with type validation, and biometric verification with liveness detection. Phone verification supports both SMS and WhatsApp delivery methods. Document processing includes file type validation, image optimization, and metadata extraction. Biometric verification captures live video frames, performs liveness detection, and calculates face matching scores against uploaded ID documents. Each step updates the verification session state and tracks completion progress.

# External Dependencies

## Database Services
- **PostgreSQL** via Neon Database for production data storage
- **Drizzle ORM** for type-safe database operations and migrations

## UI Framework and Design System
- **shadcn/ui** component library built on Radix UI primitives
- **Radix UI** for accessible, unstyled component primitives
- **TailwindCSS** for utility-first styling and design tokens

## Media Processing
- **Sharp** for server-side image processing and optimization
- **Multer** for handling multipart file uploads
- Native browser APIs for camera access and video capture

## Development and Build Tools
- **Vite** for fast development server and optimized production builds
- **TypeScript** for static type checking across the entire stack
- **ESBuild** for efficient server-side bundling and compilation

## Planned Integrations
- SMS/WhatsApp APIs for phone verification delivery
- OCR services for ID document data extraction  
- Advanced facial recognition APIs for production-grade biometric matching
- Document verification services for fraud detection
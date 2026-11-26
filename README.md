# AI College Assistant — Smart Campus Assistant

A full-stack Retrieval-Augmented Generation (RAG) web application that provides college students with instant, page-cited answers on academics, attendance, examinations, placements, admissions, fees, scholarships, events, and hostel facilities.

## Features

- **Landing Page & Public Info**: Editorial hero, feature overview, RAG workflow breakdown, interactive demo launcher, Campus Notice Board, FAQs, and About page.
- **Authentication & Role-Based Access**: Student registration/login, scrypt password hashing, HMAC-signed Bearer tokens, 1-click Demo Student mode, and first-run Administrator claim / passcode sign-in.
- **Student Dashboard**: Recent conversation history, quick question suggestions, active campus notices, and indexed college document directory.
- **AI Chatbot Workspace**: Streaming SSE answers, Markdown & code formatting, expandable PDF document + page-number citations, voice input (Web Speech Recognition), text-to-speech playback, answer regeneration, feedback ratings, conversation search, and `.md` transcript export.
- **Admin Console**: PDF upload with magic-byte & size validation, page-by-page extraction, vector embedding & chunking, category/department management, FAQ & Notice Board publishing, and usage analytics.
- **Light & Dark Mode**: Full semantic dual-theme UI across all pages.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Axios, Lucide Icons, React Markdown
- **Backend**: Node.js, Express, Multer, `pdf-parse`, `@google/genai` (`gemini-4-hydrogen` + `gemini-embedding-2`)
- **Database**: SQLite (`better-sqlite3`) storing users, documents, document chunks + embeddings, conversations, messages, FAQs, and notices.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` to `.env`):
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   APP_URL="http://localhost:3000"
   ADMIN_PASSCODE=""
   ```
3. Start the full-stack development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

## API Overview

- `GET /api/health` — Server and index status
- `POST /api/auth/register` — Student registration
- `POST /api/auth/login` — User sign-in
- `POST /api/auth/demo` — Demo student session
- `POST /api/auth/claim-admin` — First-run administrator claim
- `GET /api/auth/me` — Current authenticated user
- `POST /api/chat` — Streaming SSE RAG query & response
- `GET /api/chat/history` — Conversation list & search (`?q=`)
- `DELETE /api/chat/:conversationId` — Delete conversation
- `POST /api/documents/upload` — Admin PDF upload, extraction, chunking, embedding
- `GET /api/documents` & `DELETE /api/documents/:id` — Document management
- `GET /api/admin/dashboard` & `GET /api/admin/statistics` — Admin KPIs & analytics

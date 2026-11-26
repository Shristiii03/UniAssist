import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import {
  db,
  DOCUMENT_CATEGORIES,
  DEPARTMENTS,
} from './db.ts';
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  requireAdmin,
  type AuthedRequest,
} from './auth.ts';
import {
  extractPdfPages,
  chunkPages,
  embedTexts,
  retrieveRelevantChunks,
  retrieveCampusNoticesAndFaqs,
  streamRagResponse,
  type ChatTurn,
  type ChatMode,
} from './rag.ts';

export const apiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' || (file.mimetype !== 'application/pdf' && file.mimetype !== 'application/octet-stream')) {
      cb(new Error('Only valid PDF files (.pdf) up to 10 MB are allowed.'));
      return;
    }
    cb(null, true);
  },
});

// Health
apiRouter.get('/health', (_req, res) => {
  const docs = (db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }).cnt;
  const chunks = (db.prepare('SELECT COUNT(*) as cnt FROM document_chunks').get() as { cnt: number }).cnt;
  res.json({
    status: 'ok',
    database: 'sqlite',
    documentsIndexed: docs,
    chunksIndexed: chunks,
    timestamp: new Date().toISOString(),
  });
});

// Metadata constants
apiRouter.get('/meta', (_req, res) => {
  res.json({
    categories: DOCUMENT_CATEGORIES,
    departments: DEPARTMENTS,
  });
});

// Auth endpoints
apiRouter.get('/auth/admin-status', (_req, res) => {
  const adminCount = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get() as { cnt: number }).cnt;
  const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
  res.json({
    hasAdmin: adminCount > 0,
    envPasscodeConfigured,
  });
});

apiRouter.post('/auth/register', (req, res) => {
  const { name, email, password, department } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    return;
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid college email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const dept =
    typeof department === 'string' && (DEPARTMENTS as readonly string[]).includes(department)
      ? department
      : 'Computer Science';

  const hashed = hashPassword(password);
  const info = db
    .prepare('INSERT INTO users (name, email, hashed_password, role, department) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), normalizedEmail, hashed, 'student', dept);

  const user = db
    .prepare('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as {
    id: number;
    name: string;
    email: string;
    role: 'student' | 'admin';
    department: string;
    created_at: string;
  };

  const token = signToken(user);
  res.status(201).json({ token, user });
});

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const row = db
    .prepare('SELECT id, name, email, hashed_password, role, department, created_at FROM users WHERE email = ?')
    .get(normalizedEmail) as
    | {
        id: number;
        name: string;
        email: string;
        hashed_password: string;
        role: 'student' | 'admin';
        department: string;
        created_at: string;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.hashed_password)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    created_at: row.created_at,
  };
  const token = signToken(user);
  res.json({ token, user });
});

apiRouter.post('/auth/claim-admin', (req, res) => {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    res.status(403).json({ error: 'Admin access is managed by server environment passcode.' });
    return;
  }

  const { name, email, password } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Administrator name must be at least 2 characters.' });
    return;
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please provide a valid administrator email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const claimedUser = db.transaction(() => {
      const adminCount = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get() as { cnt: number }).cnt;
      if (adminCount > 0) {
        throw new Error('ADMIN_ALREADY_CLAIMED');
      }
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
      if (existingEmail) {
        throw new Error('EMAIL_IN_USE');
      }
      const hashed = hashPassword(password);
      const info = db
        .prepare("INSERT INTO users (name, email, hashed_password, role, department) VALUES (?, ?, ?, 'admin', 'All Departments')")
        .run(name.trim(), normalizedEmail, hashed);
      return db
        .prepare('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as {
        id: number;
        name: string;
        email: string;
        role: 'student' | 'admin';
        department: string;
        created_at: string;
      };
    })();

    const token = signToken(claimedUser);
    res.status(201).json({ token, user: claimedUser });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'ADMIN_ALREADY_CLAIMED') {
      res.status(409).json({ error: 'An administrator account has already been claimed. Please sign in.' });
      return;
    }
    if (msg === 'EMAIL_IN_USE') {
      res.status(409).json({ error: 'This email is already registered as a student. Use another email for Admin.' });
      return;
    }
    res.status(500).json({ error: 'Could not complete administrator setup.' });
  }
});

apiRouter.post('/auth/admin-passcode', (req, res) => {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (!envPasscode) {
    res.status(400).json({ error: 'Server ADMIN_PASSCODE is not configured.' });
    return;
  }

  const { passcode } = req.body ?? {};
  if (typeof passcode !== 'string') {
    res.status(400).json({ error: 'Passcode is required.' });
    return;
  }

  const inputBuf = Buffer.from(passcode, 'utf8');
  const expectedBuf = Buffer.from(envPasscode, 'utf8');
  if (inputBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(inputBuf, expectedBuf)) {
    res.status(401).json({ error: 'Invalid administrator passcode.' });
    return;
  }

  let admin = db
    .prepare("SELECT id, name, email, role, department, created_at FROM users WHERE role = 'admin' LIMIT 1")
    .get() as
    | {
        id: number;
        name: string;
        email: string;
        role: 'student' | 'admin';
        department: string;
        created_at: string;
      }
    | undefined;

  if (!admin) {
    const placeholderHash = hashPassword(crypto.randomBytes(32).toString('hex'));
    const info = db
      .prepare("INSERT INTO users (name, email, hashed_password, role, department) VALUES ('Campus Administrator', 'admin@campus.edu', ?, 'admin', 'All Departments')")
      .run(placeholderHash);
    admin = db
      .prepare('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as typeof admin;
  }

  const token = signToken(admin!);
  res.json({ token, user: admin });
});

apiRouter.post('/auth/demo', (_req, res) => {
  const demoEmail = 'student.demo@campus.edu';
  let user = db
    .prepare('SELECT id, name, email, role, department, created_at FROM users WHERE email = ?')
    .get(demoEmail) as
    | {
        id: number;
        name: string;
        email: string;
        role: 'student' | 'admin';
        department: string;
        created_at: string;
      }
    | undefined;

  if (!user) {
    const randomHash = hashPassword(crypto.randomBytes(24).toString('hex'));
    const info = db
      .prepare("INSERT INTO users (name, email, hashed_password, role, department) VALUES ('Aarav Mehta', ?, ?, 'student', 'Computer Science')")
      .run(demoEmail, randomHash);
    user = db
      .prepare('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as typeof user;
  }

  const token = signToken(user!);
  res.json({ token, user });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

// Chat endpoints
apiRouter.get('/chat/history', requireAuth, (req: AuthedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const userId = req.user!.id;

  let conversations;
  if (q) {
    const like = `%${q}%`;
    conversations = db
      .prepare(
        `
        SELECT DISTINCT c.id, c.title, c.department, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.user_id = ? AND (c.title LIKE ? OR m.message LIKE ?)
        ORDER BY c.updated_at DESC
        LIMIT 50
      `
      )
      .all(userId, like, like);
  } else {
    conversations = db
      .prepare(
        `
        SELECT c.id, c.title, c.department, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        WHERE c.user_id = ?
        ORDER BY c.updated_at DESC
        LIMIT 50
      `
      )
      .all(userId);
  }

  res.json({ conversations });
});

apiRouter.get('/chat/:conversationId', requireAuth, (req: AuthedRequest, res) => {
  const conversationId = Number(req.params.conversationId);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ error: 'Invalid conversation ID.' });
    return;
  }

  const conv = db
    .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(conversationId, req.user!.id);

  if (!conv) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  const messages = db
    .prepare('SELECT id, conversation_id, sender, message, sources_json, feedback, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(conversationId) as Array<{
    id: number;
    conversation_id: number;
    sender: 'user' | 'assistant';
    message: string;
    sources_json: string | null;
    feedback: 'up' | 'down' | null;
    created_at: string;
  }>;

  res.json({
    conversation: conv,
    messages: messages.map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender: m.sender,
      message: m.message,
      sources: m.sources_json ? JSON.parse(m.sources_json) : [],
      feedback: m.feedback,
      created_at: m.created_at,
    })),
  });
});

apiRouter.delete('/chat/:conversationId', requireAuth, (req: AuthedRequest, res) => {
  const conversationId = Number(req.params.conversationId);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    res.status(400).json({ error: 'Invalid conversation ID.' });
    return;
  }

  const result = db
    .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .run(conversationId, req.user!.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  res.json({ deleted: true });
});

apiRouter.post('/chat/messages/:messageId/feedback', requireAuth, (req: AuthedRequest, res) => {
  const messageId = Number(req.params.messageId);
  const { feedback } = req.body ?? {};
  if (!Number.isInteger(messageId) || messageId <= 0) {
    res.status(400).json({ error: 'Invalid message ID.' });
    return;
  }
  if (feedback !== 'up' && feedback !== 'down' && feedback !== null) {
    res.status(400).json({ error: 'Feedback must be "up", "down", or null.' });
    return;
  }

  const msg = db
    .prepare(
      `
      SELECT m.id FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ? AND c.user_id = ?
    `
    )
    .get(messageId, req.user!.id);

  if (!msg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  db.prepare('UPDATE messages SET feedback = ? WHERE id = ?').run(feedback, messageId);
  res.json({ updated: true, feedback });
});

apiRouter.post('/chat', requireAuth, async (req: AuthedRequest, res) => {
  const { message, conversationId, department, regenerate, mode } = req.body ?? {};
  const userId = req.user!.id;
  const activeMode: ChatMode =
    mode === 'campus' || mode === 'study' || mode === 'career' || mode === 'all' ? mode : 'all';

  if (!regenerate && (typeof message !== 'string' || message.trim().length === 0)) {
    res.status(400).json({ error: 'Please enter a question.' });
    return;
  }

  const activeDepartment =
    typeof department === 'string' && (DEPARTMENTS as readonly string[]).includes(department)
      ? department
      : req.user!.department || 'All Departments';

  let activeConvId = Number(conversationId) || 0;
  let queryText = typeof message === 'string' ? message.trim() : '';

  if (activeConvId > 0) {
    const owned = db
      .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
      .get(activeConvId, userId);
    if (!owned) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    if (regenerate) {
      const lastUser = db
        .prepare("SELECT id, message FROM messages WHERE conversation_id = ? AND sender = 'user' ORDER BY id DESC LIMIT 1")
        .get(activeConvId) as { id: number; message: string } | undefined;
      if (!lastUser) {
        res.status(400).json({ error: 'No previous question to regenerate.' });
        return;
      }
      queryText = lastUser.message;
      const lastAssistant = db
        .prepare("SELECT id FROM messages WHERE conversation_id = ? AND sender = 'assistant' ORDER BY id DESC LIMIT 1")
        .get(activeConvId) as { id: number } | undefined;
      if (lastAssistant && lastAssistant.id > lastUser.id) {
        db.prepare('DELETE FROM messages WHERE id = ?').run(lastAssistant.id);
      }
    }
  } else {
    const title = queryText.length > 56 ? `${queryText.slice(0, 56).trim()}...` : queryText;
    const convInfo = db
      .prepare('INSERT INTO conversations (user_id, title, department) VALUES (?, ?, ?)')
      .run(userId, title, activeDepartment);
    activeConvId = Number(convInfo.lastInsertRowid);
  }

  let userMessageId: number | null = null;
  if (!regenerate) {
    const userMsgInfo = db
      .prepare("INSERT INTO messages (conversation_id, sender, message) VALUES (?, 'user', ?)")
      .run(activeConvId, queryText);
    userMessageId = Number(userMsgInfo.lastInsertRowid);
  }

  db.prepare("UPDATE conversations SET updated_at = datetime('now'), department = ? WHERE id = ?").run(
    activeDepartment,
    activeConvId
  );

  const historyRows = db
    .prepare('SELECT sender, message FROM messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(activeConvId) as ChatTurn[];

  // Retrieve relevant chunks using hybrid semantic + lexical retrieval + FAQs/Notices
  const chunks = activeMode === 'study' ? [] : await retrieveRelevantChunks(queryText, activeDepartment, 5);
  const campusContextExtra = activeMode === 'study' ? '' : retrieveCampusNoticesAndFaqs(queryText, activeDepartment);
  const sourcesPayload = chunks.map((c) => ({
    documentId: c.documentId,
    filename: c.filename,
    category: c.category,
    pageNumber: c.pageNumber,
    excerpt: c.content.length > 220 ? `${c.content.slice(0, 220)}...` : c.content,
    score: Number(c.score.toFixed(3)),
  }));

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(
    `event: meta\ndata: ${JSON.stringify({
      conversationId: activeConvId,
      userMessageId,
      sources: sourcesPayload,
    })}\n\n`
  );

  await streamRagResponse({
    res,
    query: queryText,
    chunks,
    campusContextExtra,
    history: historyRows.slice(0, -1),
    department: activeDepartment,
    mode: activeMode,
    onComplete: (fullText) => {
      const assistantInfo = db
        .prepare("INSERT INTO messages (conversation_id, sender, message, sources_json) VALUES (?, 'assistant', ?, ?)")
        .run(activeConvId, fullText, JSON.stringify(sourcesPayload));
      const assistantMessageId = Number(assistantInfo.lastInsertRowid);

      res.write(
        `event: done\ndata: ${JSON.stringify({
          conversationId: activeConvId,
          assistantMessageId,
          sources: sourcesPayload,
        })}\n\n`
      );
      res.end();
    },
  });
});

// Documents endpoints
apiRouter.get('/documents', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const department = typeof req.query.department === 'string' ? req.query.department : '';

  let sql = `
    SELECT d.id, d.filename, d.original_name, d.category, d.department, d.page_count,
           d.chunk_count, d.upload_date, d.processing_status, u.name as uploaded_by_name
    FROM documents d
    LEFT JOIN users u ON u.id = d.uploaded_by
    WHERE 1=1
  `;
  const params: string[] = [];

  if (category && category !== 'All') {
    sql += ' AND d.category = ?';
    params.push(category);
  }
  if (department && department !== 'All Departments') {
    sql += " AND (d.department = ? OR d.department = 'All Departments')";
    params.push(department);
  }
  sql += ' ORDER BY d.upload_date DESC, d.id DESC';

  const documents = db.prepare(sql).all(...params);
  res.json({ documents });
});

apiRouter.post(
  '/documents/upload',
  requireAdmin,
  upload.single('file'),
  async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Please select a PDF document to upload.' });
      return;
    }

    // Verify PDF magic header (%PDF-)
    if (file.buffer.length < 5 || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      res.status(400).json({ error: 'Uploaded file does not have a valid PDF signature.' });
      return;
    }

    const rawCategory = typeof req.body?.category === 'string' ? req.body.category : 'General Information';
    const category = (DOCUMENT_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory
      : 'General Information';

    const rawDept = typeof req.body?.department === 'string' ? req.body.department : 'All Departments';
    const department = (DEPARTMENTS as readonly string[]).includes(rawDept)
      ? rawDept
      : 'All Departments';

    const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${safeOriginalName}`;

    const docInfo = db
      .prepare(
        `
        INSERT INTO documents (filename, original_name, category, department, uploaded_by, processing_status)
        VALUES (?, ?, ?, ?, ?, 'processing')
      `
      )
      .run(storedName, safeOriginalName, category, department, req.user!.id);

    const docId = Number(docInfo.lastInsertRowid);

    try {
      const { pages, pageCount } = await extractPdfPages(file.buffer);
      const chunks = chunkPages(pages);

      if (chunks.length === 0) {
        db.prepare("UPDATE documents SET processing_status = 'failed', page_count = ? WHERE id = ?").run(
          pageCount,
          docId
        );
        res.status(422).json({
          error: 'No readable text could be extracted from this PDF. Please upload a text-based PDF rather than a scanned image.',
        });
        return;
      }

      const embeddings = await embedTexts(chunks.map((c) => c.content));

      const insertChunk = db.prepare(
        'INSERT INTO document_chunks (document_id, chunk_index, page_number, content, embedding_json) VALUES (?, ?, ?, ?, ?)'
      );
      const tx = db.transaction(() => {
        chunks.forEach((chunk, i) => {
          const vec = embeddings[i];
          insertChunk.run(docId, chunk.chunkIndex, chunk.pageNumber, chunk.content, vec ? JSON.stringify(vec) : null);
        });
        db.prepare(
          "UPDATE documents SET page_count = ?, chunk_count = ?, processing_status = 'completed' WHERE id = ?"
        ).run(pageCount, chunks.length, docId);
      });
      tx();

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
      res.status(201).json({ document });
    } catch (err) {
      db.prepare("UPDATE documents SET processing_status = 'failed' WHERE id = ?").run(docId);
      console.error('PDF extraction error:', err);
      res.status(500).json({ error: 'Failed to process PDF document.' });
    }
  }
);

apiRouter.delete('/documents/:id', requireAdmin, (req, res) => {
  const docId = Number(req.params.id);
  if (!Number.isInteger(docId) || docId <= 0) {
    res.status(400).json({ error: 'Invalid document ID.' });
    return;
  }

  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }
  res.json({ deleted: true });
});

// FAQs endpoints
apiRouter.get('/faqs', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  let faqs;
  if (category && category !== 'All') {
    faqs = db.prepare('SELECT * FROM faqs WHERE category = ? ORDER BY id DESC').all(category);
  } else {
    faqs = db.prepare('SELECT * FROM faqs ORDER BY id DESC').all();
  }
  res.json({ faqs });
});

apiRouter.post('/faqs', requireAdmin, (req, res) => {
  const { question, answer, category, department } = req.body ?? {};
  if (typeof question !== 'string' || question.trim().length < 5) {
    res.status(400).json({ error: 'Question must be at least 5 characters.' });
    return;
  }
  if (typeof answer !== 'string' || answer.trim().length < 5) {
    res.status(400).json({ error: 'Answer must be at least 5 characters.' });
    return;
  }
  const cat = (DOCUMENT_CATEGORIES as readonly string[]).includes(category) ? category : 'General Information';
  const dept = (DEPARTMENTS as readonly string[]).includes(department) ? department : 'All Departments';

  const info = db
    .prepare('INSERT INTO faqs (question, answer, category, department) VALUES (?, ?, ?, ?)')
    .run(question.trim(), answer.trim(), cat, dept);
  const faq = db.prepare('SELECT * FROM faqs WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ faq });
});

apiRouter.delete('/faqs/:id', requireAdmin, (req, res) => {
  const faqId = Number(req.params.id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    res.status(400).json({ error: 'Invalid FAQ ID.' });
    return;
  }
  const result = db.prepare('DELETE FROM faqs WHERE id = ?').run(faqId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'FAQ not found.' });
    return;
  }
  res.json({ deleted: true });
});

// Notices endpoints
apiRouter.get('/notices', (_req, res) => {
  const notices = db.prepare('SELECT * FROM notices ORDER BY published_at DESC, id DESC').all();
  res.json({ notices });
});

apiRouter.post('/notices', requireAdmin, (req: AuthedRequest, res) => {
  const { title, content, category, department } = req.body ?? {};
  if (typeof title !== 'string' || title.trim().length < 3) {
    res.status(400).json({ error: 'Notice title must be at least 3 characters.' });
    return;
  }
  if (typeof content !== 'string' || content.trim().length < 10) {
    res.status(400).json({ error: 'Notice content must be at least 10 characters.' });
    return;
  }
  const cat = (DOCUMENT_CATEGORIES as readonly string[]).includes(category) ? category : 'General Information';
  const dept = (DEPARTMENTS as readonly string[]).includes(department) ? department : 'All Departments';

  const info = db
    .prepare('INSERT INTO notices (title, content, category, department, author_name) VALUES (?, ?, ?, ?, ?)')
    .run(title.trim(), content.trim(), cat, dept, req.user!.name);
  const notice = db.prepare('SELECT * FROM notices WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ notice });
});

apiRouter.delete('/notices/:id', requireAdmin, (req, res) => {
  const noticeId = Number(req.params.id);
  if (!Number.isInteger(noticeId) || noticeId <= 0) {
    res.status(400).json({ error: 'Invalid notice ID.' });
    return;
  }
  const result = db.prepare('DELETE FROM notices WHERE id = ?').run(noticeId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Notice not found.' });
    return;
  }
  res.json({ deleted: true });
});

// Admin Dashboard & Statistics
apiRouter.get('/admin/dashboard', requireAdmin, (_req, res) => {
  const totalDocuments = (db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }).cnt;
  const totalChunks = (db.prepare('SELECT COUNT(*) as cnt FROM document_chunks').get() as { cnt: number }).cnt;
  const totalUsers = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'student'").get() as { cnt: number }).cnt;
  const totalConversations = (db.prepare('SELECT COUNT(*) as cnt FROM conversations').get() as { cnt: number }).cnt;
  const totalMessages = (db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE sender = 'user'").get() as { cnt: number }).cnt;
  const totalFaqs = (db.prepare('SELECT COUNT(*) as cnt FROM faqs').get() as { cnt: number }).cnt;

  const recentDocuments = db
    .prepare('SELECT * FROM documents ORDER BY upload_date DESC, id DESC LIMIT 10')
    .all();

  res.json({
    summary: {
      totalDocuments,
      totalChunks,
      totalUsers,
      totalConversations,
      totalMessages,
      totalFaqs,
    },
    recentDocuments,
  });
});

apiRouter.get('/admin/statistics', requireAdmin, (_req, res) => {
  const categoryBreakdown = db
    .prepare('SELECT category, COUNT(*) as count, COALESCE(SUM(chunk_count), 0) as chunks FROM documents GROUP BY category ORDER BY count DESC')
    .all();

  const departmentConversations = db
    .prepare('SELECT department, COUNT(*) as count FROM conversations GROUP BY department ORDER BY count DESC')
    .all();

  const feedbackStats = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN feedback = 'up' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN feedback = 'down' THEN 1 ELSE 0 END) as negative,
        COUNT(*) as totalAssistantMessages
      FROM messages
      WHERE sender = 'assistant'
    `
    )
    .get();

  const recentQuestions = db
    .prepare(
      `
      SELECT m.message, c.department, m.created_at
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.sender = 'user'
      ORDER BY m.id DESC
      LIMIT 8
    `
    )
    .all();

  res.json({
    categoryBreakdown,
    departmentConversations,
    feedbackStats,
    recentQuestions,
  });
});

// Error handler for Multer file validation errors
apiRouter.use((err: unknown, _req: unknown, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'PDF file exceeds the 10 MB maximum upload limit.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

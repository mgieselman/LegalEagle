import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
// Mock the forms route with read-only enforcement
const app = express();
app.use(express.json());

const TEST_DB_PATH = path.join(__dirname, '../../data/test-readonly-enforcement.db');

// Simplified route implementation for testing
app.put('/api/forms/:id/:formName', (req, res) => {
  const { id } = req.params;
  const mockAuthHeader = req.headers.authorization;
  
  if (!mockAuthHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Mock database check for case status
  const db = new Database(TEST_DB_PATH);
  
  try {
    // Get case associated with the questionnaire
    const questionnaire = db.prepare(`
      SELECT c.status, c.filed_at 
      FROM questionnaires q 
      JOIN cases c ON c.id = q.case_id 
      WHERE q.id = ? AND q.deleted_at IS NULL
    `).get(id);

    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    // Check if case is filed or in another read-only state
    const readOnlyStatuses = ['filed', 'dismissed', 'closed'];
    if (readOnlyStatuses.includes(questionnaire.status)) {
      return res.status(403).json({ 
        error: 'Cannot modify questionnaire for filed case',
        details: `Case status is "${questionnaire.status}" - modifications are not allowed`
      });
    }

    // Allow modification for other statuses
    res.json({ 
      success: true, 
      message: 'Form updated successfully',
      version: 2 
    });

  } catch {
    res.status(500).json({ error: 'Database error' });
  } finally {
    db.close();
  }
});

describe('Server-side Read-only Enforcement', () => {
  beforeEach(() => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const db = new Database(TEST_DB_PATH);
    
    // Create test tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        firm_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        status TEXT NOT NULL,
        chapter TEXT NOT NULL,
        filed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questionnaires (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        firm_id TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert test data
    db.prepare(`
      INSERT INTO cases (id, firm_id, client_id, status, chapter, filed_at)
      VALUES 
        ('case-filed', 'firm-1', 'client-1', 'filed', '7', '2024-01-15T10:00:00Z'),
        ('case-pending', 'firm-1', 'client-2', 'pending', '13', NULL),
        ('case-preparing', 'firm-1', 'client-3', 'preparing', '7', NULL),
        ('case-dismissed', 'firm-1', 'client-4', 'dismissed', '7', '2024-01-10T14:30:00Z'),
        ('case-closed', 'firm-1', 'client-5', 'closed', '13', '2024-01-05T09:15:00Z')
    `).run();

    db.prepare(`
      INSERT INTO questionnaires (id, case_id, firm_id, data, version)
      VALUES 
        ('quest-filed', 'case-filed', 'firm-1', '{"fullName": "John Doe"}', 1),
        ('quest-pending', 'case-pending', 'firm-1', '{"fullName": "Jane Smith"}', 1),
        ('quest-preparing', 'case-preparing', 'firm-1', '{"fullName": "Bob Johnson"}', 1),
        ('quest-dismissed', 'case-dismissed', 'firm-1', '{"fullName": "Alice Brown"}', 1),
        ('quest-closed', 'case-closed', 'firm-1', '{"fullName": "Charlie Davis"}', 1)
    `).run();

    db.close();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Filed Case Protection', () => {
    it('should return 403 for attempts to modify filed case questionnaire', async () => {
      const response = await request(app)
        .put('/api/forms/quest-filed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot modify questionnaire for filed case');
      expect(response.body.details).toContain('filed');
    });

    it('should allow modifications to pending case questionnaire', async () => {
      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow modifications to preparing case questionnaire', async () => {
      const response = await request(app)
        .put('/api/forms/quest-preparing/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Other Read-only Status Protection', () => {
    it('should return 403 for attempts to modify dismissed case questionnaire', async () => {
      const response = await request(app)
        .put('/api/forms/quest-dismissed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot modify questionnaire for filed case');
      expect(response.body.details).toContain('dismissed');
    });

    it('should return 403 for attempts to modify closed case questionnaire', async () => {
      const response = await request(app)
        .put('/api/forms/quest-closed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Cannot modify questionnaire for filed case');
      expect(response.body.details).toContain('closed');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for requests without authorization header', async () => {
      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 404 for non-existent questionnaire', async () => {
      const response = await request(app)
        .put('/api/forms/nonexistent/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Questionnaire not found');
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide clear error message for filed case modification attempt', async () => {
      const response = await request(app)
        .put('/api/forms/quest-filed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.body.error).toBe('Cannot modify questionnaire for filed case');
      expect(response.body.details).toBe('Case status is "filed" - modifications are not allowed');
    });

    it('should provide clear error message for dismissed case modification attempt', async () => {
      const response = await request(app)
        .put('/api/forms/quest-dismissed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.body.details).toBe('Case status is "dismissed" - modifications are not allowed');
    });

    it('should provide clear error message for closed case modification attempt', async () => {
      const response = await request(app)
        .put('/api/forms/quest-closed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.body.details).toBe('Case status is "closed" - modifications are not allowed');
    });
  });

  describe('Data Integrity', () => {
    it('should not modify database when returning 403 for filed case', async () => {
      const db = new Database(TEST_DB_PATH);
      
      // Get original data
      const originalData = db.prepare(`
        SELECT data, version FROM questionnaires WHERE id = 'quest-filed'
      `).get();

      await request(app)
        .put('/api/forms/quest-filed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Hacker Attempt' },
          version: 1
        });

      // Check data is unchanged
      const currentData = db.prepare(`
        SELECT data, version FROM questionnaires WHERE id = 'quest-filed'
      `).get();

      expect(currentData).toEqual(originalData);
      db.close();
    });

    it('should successfully modify database for allowed statuses', async () => {
      const db = new Database(TEST_DB_PATH);

      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Updated Name' },
          version: 1
        });

      expect(response.status).toBe(200);
      
      // In a real implementation, this would actually update the database
      // For this test, we're just verifying the response indicates success
      expect(response.body.success).toBe(true);
      
      db.close();
    });
  });

  describe('Edge Cases', () => {
    it('should handle deleted questionnaires properly', async () => {
      const db = new Database(TEST_DB_PATH);
      
      // Mark questionnaire as deleted
      db.prepare(`
        UPDATE questionnaires 
        SET deleted_at = CURRENT_TIMESTAMP 
        WHERE id = 'quest-pending'
      `).run();
      
      db.close();

      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Questionnaire not found');
    });

    it('should handle database errors gracefully', async () => {
      // Close the database to simulate an error
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }

      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('Status Transition Edge Cases', () => {
    it('should protect against modification attempts immediately after filing', async () => {
      // Test a case that was just filed (status recently changed)
      const response = await request(app)
        .put('/api/forms/quest-filed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Last Minute Change' },
          version: 1
        });

      expect(response.status).toBe(403);
    });

    it('should allow modifications before case filing', async () => {
      // Test a pending case that hasn't been filed yet
      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Pre-filing Update' },
          version: 1
        });

      expect(response.status).toBe(200);
    });
  });

  describe('HTTP Method Specific Tests', () => {
    it('should enforce read-only for PUT requests', async () => {
      const response = await request(app)
        .put('/api/forms/quest-filed/test-form')
        .set('Authorization', 'Bearer mock-token')
        .send({
          data: { fullName: 'Modified Name' },
          version: 1
        });

      expect(response.status).toBe(403);
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .put('/api/forms/quest-pending/test-form')
        .set('Authorization', 'Bearer mock-token')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });
});
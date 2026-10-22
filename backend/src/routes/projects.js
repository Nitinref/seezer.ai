import { Router } from 'express';
import prisma from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { restoreProjectPreview } from '../tools/sandboxTools.js';

const router = Router();

// All project routes require auth
router.use(authenticate);

// GET /projects
router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ projects });
  } catch (err) {
    console.error('[projects/list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /projects
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const project = await prisma.project.create({
      data: { name, description: description ?? null, userId: req.user.id },
    });
    return res.status(201).json({ project });
  } catch (err) {
    console.error('[projects/create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    return res.json({ project });
  } catch (err) {
    console.error('[projects/get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Recreate an expired E2B sandbox and obtain a fresh preview URL for a
// reopened project. The project source is restored from ProjectFile records.
router.post('/:id/restore-preview', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, previewUrl: true },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.previewUrl) return res.status(409).json({ error: 'This project has no preview yet' });

    const previewUrl = await restoreProjectPreview(project.id);
    return res.json({ previewUrl });
  } catch (err) {
    console.error('[projects/restore-preview]', err);
    return res.status(502).json({ error: err.message || 'Could not restore preview' });
  }
});

// DELETE /projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    return res.status(204).send();
  } catch (err) {
    console.error('[projects/delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /projects/:id/files  — metadata only (id, path, updatedAt)
router.get('/:id/files', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const files = await prisma.projectFile.findMany({
      where: { projectId: req.params.id },
      select: { id: true, path: true, updatedAt: true },
      orderBy: { path: 'asc' },
    });
    return res.json({ files });
  } catch (err) {
    console.error('[projects/files]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /projects/:id/download  — all files as JSON attachment
router.get('/:id/download', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const files = await prisma.projectFile.findMany({
      where: { projectId: req.params.id },
      orderBy: { path: 'asc' },
    });

    res.setHeader('Content-Disposition', `attachment; filename="${project.name}-files.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ project, files }, null, 2));
  } catch (err) {
    console.error('[projects/download]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /projects/:id/files/:file+  — single file content (must be AFTER /files route)
// GET /projects/:id/files/*file  — single file content
// GET /projects/:id/files/*file  — single file content
router.get('/:id/files/*file', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // ✅ Fix: Express may return array or string depending on version
    const raw = req.params.file;
    const filePath = Array.isArray(raw) ? raw.join('/') : raw;

    const file = await prisma.projectFile.findUnique({
      where: {
        projectId_path: {
          projectId: req.params.id,
          path: filePath,
        },
      },
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    return res.json({ file });
  } catch (err) {
    console.error('[projects/file]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

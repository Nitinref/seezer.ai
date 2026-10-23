import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db/index.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = Router();

function serializeUser(user) {
  return {
    ...user,
    creditBalanceUsd: Number(user.creditBalanceUsd ?? 0),
  };
}

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name ?? null },
      select: { id: true, email: true, name: true, createdAt: true, creditBalanceUsd: true },
    });

    const token = signToken({ id: user.id, email: user.email });
    return res.status(201).json({ user: serializeUser(user), token });
  } catch (err) {
    console.error('[auth/signup]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ id: user.id, email: user.email });
    const { password: _pwd, ...safeUser } = user;
    return res.json({ user: serializeUser(safeUser), token });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, createdAt: true, creditBalanceUsd: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: serializeUser(user) });
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/credits — current AI-credit balance for the signed-in user.
router.get('/credits', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { creditBalanceUsd: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ balanceUsd: Number(user.creditBalanceUsd) });
  } catch (err) {
    console.error('[auth/credits]', err);
    return res.status(500).json({ error: 'Unable to load credit balance' });
  }
});

export default router;

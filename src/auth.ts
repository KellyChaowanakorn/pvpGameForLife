import jwt from 'jsonwebtoken';
import axios from 'axios';
import { UserService } from './db/user';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '';

// ===== JWT =====
export function generateToken(userId: number, lineUserId: string): string {
  return jwt.sign({ id: userId, lineUserId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { id: number; lineUserId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; lineUserId: string };
  } catch {
    return null;
  }
}

// ===== LINE Profile =====
interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export async function getLineProfile(accessToken: string): Promise<LineProfile | null> {
  try {
    const res = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err) {
    console.error('LINE profile error:', err);
    return null;
  }
}

// ===== Login Flow =====
export async function loginWithLine(accessToken: string) {
  // Get LINE profile
  const profile = await getLineProfile(accessToken);
  if (!profile) throw new Error('Invalid LINE access token');

  // Find or create user in DB
  const user = await UserService.findOrCreate(
    profile.userId,
    profile.displayName,
    profile.pictureUrl
  );

  // Generate JWT
  const token = generateToken(user.id, user.lineUserId);

  return {
    token,
    user: {
      id: user.id,
      lineUserId: user.lineUserId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
    },
    wallet: {
      balance: user.wallet?.balance.toNumber() || 0,
    },
  };
}

// ===== Dev Login (no LINE needed) =====
export async function devLogin(name?: string) {
  const devId = `dev_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  const displayName = name || `Player_${Math.floor(Math.random() * 9999)}`;

  const user = await UserService.findOrCreate(devId, displayName);
  const token = generateToken(user.id, user.lineUserId);

  return {
    token,
    user: {
      id: user.id,
      lineUserId: user.lineUserId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
    },
    wallet: {
      balance: user.wallet?.balance.toNumber() || 0,
    },
  };
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../services/database';
import { User } from '../types';

interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'Invalid token' });
      return;
    }
    
    req.user = userResult.rows[0] as User;
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0] as User;
      }
    } catch (error) {
      // Token invalid, but that's okay for optional auth
    }
  }
  
  next();
};
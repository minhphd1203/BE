import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ApiResponse, JwtPayload } from '../models';

// Đăng ký
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role } = req.body;

    // Validate role
    if (!role || !['buyer', 'seller'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Role must be either "buyer" or "seller"',
      });
    }

    // Kiểm tra email + role đã tồn tại
    const existingUser = await db.query.users.findFirst({
      where: and(
        eq(users.email, email),
        eq(users.role, role)
      ),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `An account with this email already exists as a ${role}`,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        name,
        phone: phone || null,
        role, 
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      });

    const response: ApiResponse = {
      success: true,
      data: newUser,
      message: 'User registered successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Đăng nhập
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    // If role is not provided, try to find any user with that email
    const whereCondition = role 
      ? and(eq(users.email, email), eq(users.role, role))
      : eq(users.email, email);

    // Tìm user
    const user = await db.query.users.findFirst({
      where: whereCondition,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Kiểm tra password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Tạo JWT token
    const jwtPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET as string, {
      expiresIn: '24h',
    });

    const response: ApiResponse = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
      },
      message: 'Login successful',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Đăng xuất
export const logout = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const response: ApiResponse = {
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
      },
      message: 'Logged out successfully. Please delete the token from your client.',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging out',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ApiResponse, JwtPayload } from '../models';

// Kiểm tra available roles cho email
export const checkRoles = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Tìm TẤT CẢ users với email này
    const allUsers = await db.query.users.findMany({
      where: eq(users.email, email),
      columns: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!allUsers.length) {
      return res.status(401).json({
        success: false,
        message: 'Email not found',
      });
    }

    // Kiểm tra password với user đầu tiên (tất cả có cùng password)
    const isValidPassword = await bcrypt.compare(password, allUsers[0].password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Lấy danh sách roles
    const roles = allUsers.map(u => u.role);

    const response: ApiResponse = {
      success: true,
      data: {
        email,
        roles,
        hasMultipleRoles: roles.length > 1,
      },
      message: 'Roles available for this email',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking roles',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

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
      columns: {
        id: true,
        email: true,
        role: true,
      },
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

    // Role là bắt buộc (buyer, seller, admin, inspector)
    const validRoles = ['buyer', 'seller', 'admin', 'inspector'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be specified and be one of: buyer, seller, admin, inspector',
      });
    }

    // Tìm user với email + role cụ thể
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.email, email),
        eq(users.role, role)
      ),
      columns: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
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

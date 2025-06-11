import { Request } from 'express';
import { Types } from 'mongoose';

export interface User {
    email: string;
    password: string;
}

export interface Item {
    userId: Types.ObjectId;
    name: string;
    price: number;
}

export interface AuthRequest extends Request {
    userId?: string;
}

export interface TokenPayload {
    userId: string;
}

export interface DbSchema {
    users: User[];
    items: Item[];
} 
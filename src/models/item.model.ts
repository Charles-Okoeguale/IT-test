import mongoose, { Schema, Document } from 'mongoose';
import { Item } from '../types';

export interface ItemDocument extends Item, Document {}

const itemSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema); 
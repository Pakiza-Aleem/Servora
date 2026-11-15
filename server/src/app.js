import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { errorHandler } from './middleware/auth.js';

export const app = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration
const allowedOrigins = [
    'http://localhost:5173',
    'https://servora-restaurant.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use(
    '/uploads',
    express.static(
        path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../uploads'
        )
    )
);

app.use('/api', routes);

// Single-service deploy: serve the built client if present.
const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../client/dist'
);

if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);
import express, { Express, Request, Response, NextFunction } from 'express';

process.on('warning', (warning: any) => {
  if (warning.name === 'DeprecationWarning' && (warning.code === 'DEP0169' || warning.message?.includes('url.parse'))) {
    return;
  }
  console.warn(warning);
});
import cookieParser from 'cookie-parser';
import { securityHeaders } from './middleware/security';
import { authenticateToken } from './middleware/auth';
import authRoutes from './routes/auth';
import restaurantRoutes from './routes/restaurants';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';
import d1Routes from './routes/d1';
import settingsRoutes from './routes/settings';
import storageRoutes from './routes/storage';
import reviewsRoutes from './routes/reviews';
import geocodeRoutes from './routes/geocode';
import supportRoutes from './routes/support';

export function createServerApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(securityHeaders);

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  app.use(authenticateToken);

  const apiRouter = express.Router();

  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/restaurants', restaurantRoutes);
  apiRouter.use('/orders', orderRoutes);
  apiRouter.use('/payments', paymentRoutes);
  apiRouter.use('/payment', paymentRoutes);
  apiRouter.use('/webhooks', webhookRoutes);
  apiRouter.use('/admin', adminRoutes);
  apiRouter.use('/health', healthRoutes);
  apiRouter.use('/d1', d1Routes);
  apiRouter.use('/settings', settingsRoutes);
  apiRouter.use('/storage', storageRoutes);
  apiRouter.use('/reviews', reviewsRoutes);
  apiRouter.use('/geocode', geocodeRoutes);
  apiRouter.use('/support', supportRoutes);

  app.get(['/api', '/api/'], (req: Request, res: Response) => {
    res.status(200).json({ success: true, status: 'operational' });
  });

  app.use('/api', apiRouter);

  app.use(['/api', '/api/*'], (req: Request, res: Response, next: NextFunction) => {
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        error: `API route ${req.method} ${req.originalUrl || req.url || req.path} not found.`
      });
    } else {
      next();
    }
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'An internal server error occurred.'
      });
    }
  });

  return app;
}

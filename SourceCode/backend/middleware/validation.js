import { z } from 'zod';

/**
 * Validation middleware factory using Zod schemas
 */
export const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      // Validate request body, params, and query based on schema
      const validated = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query
      });

      // Replace request with validated data
      req.body = validated.body || req.body;
      req.params = validated.params || req.params;
      req.query = validated.query || req.query;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  // Pagination
  pagination: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
      limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      search: z.string().optional()
    })
  }),

  // UUID parameter
  uuidParam: z.object({
    params: z.object({
      id: z.string().uuid('Invalid UUID format')
    })
  }),

  // Date range
  dateRange: z.object({
    query: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })
  }),

  // Login
  login: z.object({
    body: z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      password: z.string().min(6, 'Password must be at least 6 characters')
    })
  }),

  // Claim correction
  claimCorrection: z.object({
    body: z.object({
      fieldName: z.string(),
      oldValue: z.string().optional(),
      newValue: z.string(),
      correctionReason: z.string().optional()
    }),
    params: z.object({
      id: z.string().uuid()
    })
  })
};

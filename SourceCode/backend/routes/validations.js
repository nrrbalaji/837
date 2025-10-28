import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getValidationSummary, aiAssistedValidation } from '../services/validation.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * @route   GET /api/v1/validations/:claimId
 * @desc    Get validation errors for a claim
 * @access  Private
 */
router.get('/:claimId', async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const errors = await getValidationSummary(claimId);
    res.json(errors);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/validations/:claimId/ai-assist
 * @desc    Get AI-assisted validation suggestions
 * @access  Private
 */
router.post('/:claimId/ai-assist', async (req, res, next) => {
  try {
    const { claimId } = req.params;
    const result = await aiAssistedValidation(claimId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

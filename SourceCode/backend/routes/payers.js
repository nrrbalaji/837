import express from 'express';
import {
  getAllPayers,
  getPayerById,
  createPayer,
  updatePayer,
  deletePayer,
  testPayerConnection
} from '../services/payerService.js';
import { authenticateToken } from '../middleware/auth.js';
import { masterPermissions } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @route   GET /api/v1/payers
 * @desc    Get all payers with filtering, sorting, and pagination
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const {
      page,
      limit,
      sortField = 'payer_name',
      sortOrder = 'asc',
      search = '',
      payerType = '',
      transmissionMethod = '',
      state = '',
      isActive = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    // If no pagination params, return simple list for dropdowns (no permissions required)
    if (!page || !limit) {
      const payers = await getAllPayers();
      res.json(payers);
      return;
    }

    // For paginated requests, require permissions
    await masterPermissions.read(req, res, () => {});

    const filters = {
      search,
      payerType,
      transmissionMethod,
      state,
      isActive,
      dateFrom,
      dateTo
    };

    const result = await getAllPayers({
      page: parseInt(page),
      limit: parseInt(limit),
      sortField,
      sortOrder,
      filters
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/payers/:id
 * @desc    Get payer by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const { id } = req.params;
    const payer = await getPayerById(id);

    if (!payer) {
      return res.status(404).json({ error: 'Payer not found' });
    }

    res.json(payer);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/payers
 * @desc    Create new payer
 * @access  Private
 */
router.post('/', authenticateToken, masterPermissions.create, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const payerData = {
      ...req.body,
      created_by: userId,
      updated_by: userId
    };

    const payer = await createPayer(payerData);
    res.status(201).json(payer);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Payer code already exists' });
    }
    next(error);
  }
});

/**
 * @route   PUT /api/v1/payers/:id
 * @desc    Update payer
 * @access  Private
 */
router.put('/:id', authenticateToken, masterPermissions.update, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const payerData = {
      ...req.body,
      updated_by: userId
    };

    const payer = await updatePayer(id, payerData);

    if (!payer) {
      return res.status(404).json({ error: 'Payer not found' });
    }

    res.json(payer);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Payer code already exists' });
    }
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/payers/:id
 * @desc    Delete payer (soft delete - set is_active to false)
 * @access  Private
 */
router.delete('/:id', authenticateToken, masterPermissions.delete, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const result = await deletePayer(id, userId);

    if (!result) {
      return res.status(404).json({ error: 'Payer not found' });
    }

    res.json({ message: 'Payer deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/payers/test-connection
 * @desc    Test payer transmission connection
 * @access  Private
 */
router.post('/test-connection', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const result = await testPayerConnection(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

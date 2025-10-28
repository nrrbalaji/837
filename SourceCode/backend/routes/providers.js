import express from 'express';
import {
  getAllProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  getProviderPayerMappings,
  addProviderPayerMapping,
  updateProviderPayerMapping,
  deleteProviderPayerMapping
} from '../services/providerService.js';
import { authenticateToken } from '../middleware/auth.js';
import { masterPermissions } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @route   GET /api/v1/providers
 * @desc    Get all providers with filtering, sorting, and pagination
 * @access  Private
 */
router.get('/', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortField = 'first_name',
      sortOrder = 'asc',
      providerName = '',
      npi = '',
      taxId = '',
      facilityType = '',
      status = ''
    } = req.query;

    const filters = {
      providerName,
      npi,
      taxId,
      facilityType,
      status: status === '' ? null : status === 'Active'
    };

    const result = await getAllProviders({
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
 * @route   GET /api/v1/providers/:id
 * @desc    Get provider by ID with payer mappings
 * @access  Private
 */
router.get('/:id', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const { id } = req.params;
    const provider = await getProviderById(id);

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(provider);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/providers
 * @desc    Create new provider
 * @access  Private
 */
router.post('/', authenticateToken, masterPermissions.create, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const providerData = {
      ...req.body,
      created_by: userId,
      updated_by: userId
    };

    const provider = await createProvider(providerData);
    res.status(201).json(provider);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Provider with this NPI already exists' });
    }
    next(error);
  }
});

/**
 * @route   PUT /api/v1/providers/:id
 * @desc    Update provider
 * @access  Private
 */
router.put('/:id', authenticateToken, masterPermissions.update, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const providerData = {
      ...req.body,
      updated_by: userId
    };

    const provider = await updateProvider(id, providerData);

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(provider);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Provider with this NPI already exists' });
    }
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/providers/:id
 * @desc    Delete provider (soft delete - set is_active to false)
 * @access  Private
 */
router.delete('/:id', authenticateToken, masterPermissions.delete, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const result = await deleteProvider(id, userId);

    if (!result) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/providers/:id/payers
 * @desc    Get payer mappings for a provider
 * @access  Private
 */
router.get('/:id/payers', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const { id } = req.params;
    const mappings = await getProviderPayerMappings(id);
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/providers/:id/payers
 * @desc    Add payer mapping to provider
 * @access  Private
 */
router.post('/:id/payers', authenticateToken, masterPermissions.create, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const mappingData = {
      ...req.body,
      provider_id: id,
      created_by: userId
    };

    const mapping = await addProviderPayerMapping(mappingData);
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/providers/:id/payers/:mappingId
 * @desc    Update payer mapping
 * @access  Private
 */
router.put('/:id/payers/:mappingId', authenticateToken, masterPermissions.update, async (req, res, next) => {
  try {
    const { mappingId } = req.params;
    const userId = req.user.user_id;
    const mappingData = {
      ...req.body,
      updated_by: userId
    };

    const mapping = await updateProviderPayerMapping(mappingId, mappingData);

    if (!mapping) {
      return res.status(404).json({ error: 'Payer mapping not found' });
    }

    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/providers/:id/payers/:mappingId
 * @desc    Delete payer mapping
 * @access  Private
 */
router.delete('/:id/payers/:mappingId', authenticateToken, masterPermissions.delete, async (req, res, next) => {
  try {
    const { mappingId } = req.params;

    const result = await deleteProviderPayerMapping(mappingId);

    if (!result) {
      return res.status(404).json({ error: 'Payer mapping not found' });
    }

    res.json({ message: 'Payer mapping deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

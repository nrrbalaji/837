import express from 'express';
import {
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility
} from '../services/facilityService.js';
import { authenticateToken } from '../middleware/auth.js';
import { masterPermissions } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @route   GET /api/v1/facilities
 * @desc    Get all facilities with filtering, sorting, and pagination
 * @access  Private
 */
router.get('/', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const {
      page,
      limit,
      sortField = 'facility_name',
      sortOrder = 'asc',
      search = '',
      facilityType = '',
      state = '',
      isActive = ''
    } = req.query;

    // Get user info from request
    const userId = req.user?.user_id;
    const userRoles = req.user?.roles || [];
    // roles is an array of objects with role_name property from RBAC middleware
    const isAdmin = userRoles.some(role => {
      const roleName = typeof role === 'string' ? role : role.role_name;
      return roleName && roleName.toLowerCase().includes('admin');
    });

    // If no pagination params, return simple list
    if (!page || !limit) {
      const facilities = await getAllFacilities({ userId, isAdmin });
      res.json(facilities);
      return;
    }

    const filters = {
      search,
      facilityType,
      state,
      isActive
    };

    const result = await getAllFacilities({
      page: parseInt(page),
      limit: parseInt(limit),
      sortField,
      sortOrder,
      filters,
      userId,
      isAdmin
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/facilities/:id
 * @desc    Get facility by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const { id } = req.params;
    const facility = await getFacilityById(id);

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    res.json(facility);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/facilities
 * @desc    Create new facility
 * @access  Private
 */
router.post('/', authenticateToken, masterPermissions.create, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const facilityData = {
      ...req.body,
      created_by: userId,
      updated_by: userId
    };

    const facility = await createFacility(facilityData);
    res.status(201).json(facility);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Facility code already exists' });
    }
    next(error);
  }
});

/**
 * @route   PUT /api/v1/facilities/:id
 * @desc    Update facility
 * @access  Private
 */
router.put('/:id', authenticateToken, masterPermissions.update, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const facilityData = {
      ...req.body,
      updated_by: userId
    };

    const facility = await updateFacility(id, facilityData);

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    res.json(facility);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Facility code already exists' });
    }
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/facilities/:id
 * @desc    Delete facility (soft delete - set is_active to false)
 * @access  Private
 */
router.delete('/:id', authenticateToken, masterPermissions.delete, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const result = await deleteFacility(id, userId);

    if (!result) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    res.json({ message: 'Facility deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

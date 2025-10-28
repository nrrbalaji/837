import express from 'express';
import {
  getAllTradingPartners,
  getTradingPartnerById,
  createTradingPartner,
  updateTradingPartner,
  deleteTradingPartner,
  bulkImportTradingPartners
} from '../services/tradingPartnerService.js';
import { authenticateToken } from '../middleware/auth.js';
import { masterPermissions } from '../middleware/rbac.js';
import {
  uploadMiddleware,
  parseCSV,
  validateCSVData,
  exportToCSV,
  tradingPartnerSchema,
  exportFields,
  cleanupFile
} from '../utils/csvHandler.js';

const router = express.Router();

/**
 * @route   GET /api/v1/trading-partners
 * @desc    Get all trading partners with filtering, sorting, and pagination
 * @access  Private (requires masters:read permission)
 */
router.get('/', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortField = 'partner_name',
      sortOrder = 'asc',
      partnerName = '',
      partnerType = '',
      direction = '',
      channelType = '',
      status = '',
      isActive
    } = req.query;

    const filters = {
      partnerName,
      partnerType,
      direction,
      channelType,
      status,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null
    };

    const result = await getAllTradingPartners({
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
 * @route   GET /api/v1/trading-partners/:id
 * @desc    Get trading partner by ID
 * @access  Private (requires masters:read permission)
 */
router.get('/:id', authenticateToken, masterPermissions.read, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tradingPartner = await getTradingPartnerById(id);

    if (!tradingPartner) {
      return res.status(404).json({ error: 'Trading partner not found' });
    }

    res.json(tradingPartner);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/trading-partners
 * @desc    Create new trading partner
 * @access  Private (requires masters:create permission - Admin only)
 */
router.post('/', authenticateToken, masterPermissions.create, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const auditInfo = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      reason: req.body.audit_reason
    };

    const tradingPartner = await createTradingPartner(req.body, userId, auditInfo);
    res.status(201).json(tradingPartner);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Trading partner with this ID already exists' });
    }
    next(error);
  }
});

/**
 * @route   PUT /api/v1/trading-partners/:id
 * @desc    Update trading partner
 * @access  Private (requires masters:update permission - Admin only)
 */
router.put('/:id', authenticateToken, masterPermissions.update, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const auditInfo = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      reason: req.body.audit_reason
    };

    const tradingPartner = await updateTradingPartner(id, req.body, userId, auditInfo);

    if (!tradingPartner) {
      return res.status(404).json({ error: 'Trading partner not found' });
    }

    res.json(tradingPartner);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Trading partner with this configuration already exists' });
    }
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/trading-partners/:id
 * @desc    Delete trading partner (soft delete)
 * @access  Private (requires masters:delete permission - Admin only)
 */
router.delete('/:id', authenticateToken, masterPermissions.delete, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const auditInfo = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      reason: req.body?.audit_reason
    };

    const result = await deleteTradingPartner(id, userId, auditInfo);

    if (!result) {
      return res.status(404).json({ error: 'Trading partner not found' });
    }

    res.json({ message: 'Trading partner deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/trading-partners/import
 * @desc    Import trading partners from CSV
 * @access  Private (requires masters:import permission - Admin only)
 */
router.post(
  '/import',
  authenticateToken,
  masterPermissions.import,
  uploadMiddleware.single('file'),
  async (req, res, next) => {
    let filePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      filePath = req.file.path;
      const userId = req.user.user_id;

      // Parse CSV
      const parsedData = await parseCSV(filePath);

      // Validate data
      const validation = validateCSVData(parsedData, tradingPartnerSchema);

      if (!validation.valid) {
        return res.status(400).json({
          error: 'CSV validation failed',
          errors: validation.errors,
          totalRecords: validation.totalRecords,
          errorCount: validation.errorCount
        });
      }

      // Import valid records
      const auditInfo = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        reason: 'CSV Import'
      };

      const results = await bulkImportTradingPartners(validation.validRecords, userId, auditInfo);

      res.json({
        message: 'Import completed',
        totalRecords: parsedData.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        failed: results.failed
      });
    } catch (error) {
      next(error);
    } finally {
      if (filePath) {
        await cleanupFile(filePath);
      }
    }
  }
);

/**
 * @route   GET /api/v1/trading-partners/export/csv
 * @desc    Export trading partners to CSV
 * @access  Private (requires masters:export permission)
 */
router.get('/export/csv', authenticateToken, masterPermissions.export, async (req, res, next) => {
  try {
    const result = await getAllTradingPartners({
      page: 1,
      limit: 100000, // Get all records
      sortField: 'partner_name',
      sortOrder: 'asc',
      filters: {}
    });

    const csv = exportToCSV(result.tradingPartners, exportFields.tradingPartner);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=trading_partners_export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;

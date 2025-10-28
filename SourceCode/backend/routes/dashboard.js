import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * @route   GET /api/v1/dashboard/metrics
 * @desc    Get real-time dashboard metrics
 * @access  Private
 */
router.get('/metrics', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateFilter = dateFrom && dateTo
      ? `AND ch.created_at BETWEEN '${dateFrom}' AND '${dateTo}'`
      : `AND ch.created_at >= NOW() - INTERVAL '30 days'`;

    // Total claims processed
    const totalClaimsResult = await pool.query(`
      SELECT COUNT(*) as total FROM ClaimHeader ch WHERE 1=1 ${dateFilter}
    `);

    // Claims by status
    const claimsByStatusResult = await pool.query(`
      SELECT
        claim_status,
        COUNT(*) as count
      FROM ClaimHeader ch
      WHERE 1=1 ${dateFilter}
      GROUP BY claim_status
    `);

    // Validation metrics
    const validationMetricsResult = await pool.query(`
      SELECT
        validation_status,
        COUNT(*) as count
      FROM ClaimHeader ch
      WHERE 1=1 ${dateFilter}
      GROUP BY validation_status
    `);

    // Rejection rate
    const rejectionRateResult = await pool.query(`
      SELECT
        COUNT(CASE WHEN validation_status = 'FAILED' THEN 1 END) as failed,
        COUNT(*) as total
      FROM ClaimHeader ch
      WHERE 1=1 ${dateFilter}
    `);

    const rejectionRate = rejectionRateResult.rows[0].total > 0
      ? (rejectionRateResult.rows[0].failed / rejectionRateResult.rows[0].total * 100).toFixed(2)
      : 0;

    // Total charge amount
    const totalChargeResult = await pool.query(`
      SELECT COALESCE(SUM(total_charge), 0) as total_charge
      FROM ClaimHeader ch
      WHERE 1=1 ${dateFilter}
    `);

    // Top error types
    const topErrorsResult = await pool.query(`
      SELECT
        bvl.rule_name,
        COUNT(*) as error_count
      FROM BusinessValidationLog bvl
      JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
      WHERE bvl.severity = 'ERROR' ${dateFilter}
      GROUP BY bvl.rule_name
      ORDER BY error_count DESC
      LIMIT 10
    `);

    // Processing throughput (claims per hour)
    const throughputResult = await pool.query(`
      SELECT
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as claims_per_hour
      FROM ClaimHeader ch
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `);

    // Claims by payer
    const claimsByPayerResult = await pool.query(`
      SELECT
        p.payer_name,
        COUNT(*) as claim_count,
        SUM(ch.total_charge) as total_charge
      FROM ClaimHeader ch
      JOIN Payer p ON ch.payer_id = p.payer_id
      WHERE 1=1 ${dateFilter}
      GROUP BY p.payer_name
      ORDER BY claim_count DESC
      LIMIT 10
    `);

    // Claims by facility
    const claimsByFacilityResult = await pool.query(`
      SELECT
        f.facility_name,
        COUNT(*) as claim_count,
        COUNT(CASE WHEN ch.validation_status = 'FAILED' THEN 1 END) as failed_count
      FROM ClaimHeader ch
      JOIN Facilities f ON ch.facility_id = f.facility_id
      WHERE 1=1 ${dateFilter}
      GROUP BY f.facility_name
      ORDER BY claim_count DESC
      LIMIT 10
    `);

    // Correction statistics
    const correctionStatsResult = await pool.query(`
      SELECT
        correction_type,
        COUNT(*) as count
      FROM CorrectionLog cl
      JOIN ClaimHeader ch ON cl.claim_id = ch.claim_id
      WHERE 1=1 ${dateFilter}
      GROUP BY correction_type
    `);

    res.json({
      summary: {
        totalClaims: parseInt(totalClaimsResult.rows[0].total),
        totalCharge: parseFloat(totalChargeResult.rows[0].total_charge),
        rejectionRate: parseFloat(rejectionRate)
      },
      claimsByStatus: claimsByStatusResult.rows,
      validationMetrics: validationMetricsResult.rows,
      topErrors: topErrorsResult.rows,
      throughput: throughputResult.rows,
      claimsByPayer: claimsByPayerResult.rows,
      claimsByFacility: claimsByFacilityResult.rows,
      correctionStats: correctionStatsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/trends
 * @desc    Get historical trend analysis
 * @access  Private
 */
router.get('/trends', async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;

    let interval;
    let dateRange;

    switch (period) {
      case '7d':
        interval = 'day';
        dateRange = '7 days';
        break;
      case '30d':
        interval = 'day';
        dateRange = '30 days';
        break;
      case '90d':
        interval = 'week';
        dateRange = '90 days';
        break;
      case '1y':
        interval = 'month';
        dateRange = '1 year';
        break;
      default:
        interval = 'day';
        dateRange = '30 days';
    }

    // Claims trend
    const claimsTrendResult = await pool.query(`
      SELECT
        DATE_TRUNC('${interval}', created_at) as period,
        COUNT(*) as total_claims,
        COUNT(CASE WHEN validation_status = 'PASSED' THEN 1 END) as passed_claims,
        COUNT(CASE WHEN validation_status = 'FAILED' THEN 1 END) as failed_claims,
        SUM(total_charge) as total_charge
      FROM ClaimHeader
      WHERE created_at >= NOW() - INTERVAL '${dateRange}'
      GROUP BY period
      ORDER BY period ASC
    `);

    // Error trend by category
    const errorTrendResult = await pool.query(`
      SELECT
        DATE_TRUNC('${interval}', bvl.validated_at) as period,
        bvl.rule_name,
        COUNT(*) as error_count
      FROM BusinessValidationLog bvl
      WHERE bvl.validated_at >= NOW() - INTERVAL '${dateRange}'
      AND bvl.severity = 'ERROR'
      GROUP BY period, bvl.rule_name
      ORDER BY period ASC, error_count DESC
    `);

    // Correction trend
    const correctionTrendResult = await pool.query(`
      SELECT
        DATE_TRUNC('${interval}', corrected_at) as period,
        correction_type,
        COUNT(*) as correction_count
      FROM CorrectionLog
      WHERE corrected_at >= NOW() - INTERVAL '${dateRange}'
      GROUP BY period, correction_type
      ORDER BY period ASC
    `);

    res.json({
      claimsTrend: claimsTrendResult.rows,
      errorTrend: errorTrendResult.rows,
      correctionTrend: correctionTrendResult.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/payer-performance
 * @desc    Get payer-specific performance scorecards
 * @access  Private
 */
router.get('/payer-performance', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        p.payer_id,
        p.payer_name,
        COUNT(ch.claim_id) as total_claims,
        COUNT(CASE WHEN ch.validation_status = 'PASSED' THEN 1 END) as passed_claims,
        COUNT(CASE WHEN ch.validation_status = 'FAILED' THEN 1 END) as failed_claims,
        COUNT(CASE WHEN ch.transmission_status = 'TRANSMITTED' THEN 1 END) as transmitted_claims,
        SUM(ch.total_charge) as total_charge,
        ROUND(
          COUNT(CASE WHEN ch.validation_status = 'PASSED' THEN 1 END)::numeric /
          NULLIF(COUNT(ch.claim_id), 0) * 100,
          2
        ) as success_rate
      FROM Payer p
      LEFT JOIN ClaimHeader ch ON p.payer_id = ch.payer_id
      WHERE ch.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY p.payer_id, p.payer_name
      ORDER BY total_claims DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;

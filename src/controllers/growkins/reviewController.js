const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_REVIEWS = 'Reviews';
const DEFAULT_HEADERS = ['id', 'productId', 'productName', 'customerName', 'rating', 'comment', 'status', 'createdAt'];

async function listReviews(req, res, next) {
  try {
    const { page = 1, limit = 50, status, rating } = req.query;
    let reviews = await sheetsService.getAllRows(SHEET_REVIEWS);

    if (status) {
      reviews = reviews.filter(r => r.status === status);
    }
    if (rating) {
      reviews = reviews.filter(r => Number(r.rating) === Number(rating));
    }

    reviews.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = reviews.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = reviews.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      data: paginated,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getReviewById(req, res, next) {
  try {
    const { id } = req.params;
    const reviews = await sheetsService.getAllRows(SHEET_REVIEWS);
    const review = reviews.find(r => String(r.id) === String(id));

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
}

async function updateReviewStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: { status: ['Status must be pending, approved, or rejected'] }
      });
    }

    const updated = await sheetsService.updateRow(SHEET_REVIEWS, 'id', id, { status, updatedAt: new Date().toISOString() });
    res.json({ success: true, data: updated, message: 'Review status updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteReview(req, res, next) {
  try {
    const { id } = req.params;
    await sheetsService.deleteRow(SHEET_REVIEWS, 'id', id);
    res.json({ success: true, data: { id }, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listReviews,
  getReviewById,
  updateReviewStatus,
  deleteReview
};

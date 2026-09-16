const { getDb } = require('../models/database');

function updateStock(productId, variantId, quantityChange, transactionType, referenceType, referenceId, notes, createdBy) {
  const db = getDb();
  
  const updateFn = db.transaction(() => {
    // Get or create stock record
    let stockRecord = db.prepare('SELECT * FROM stock WHERE product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))')
      .get(productId, variantId, variantId);
    
    if (!stockRecord) {
      db.prepare('INSERT INTO stock (product_id, variant_id, quantity) VALUES (?, ?, 0)').run(productId, variantId);
      stockRecord = db.prepare('SELECT * FROM stock WHERE product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))')
        .get(productId, variantId, variantId);
    }

    const quantityBefore = stockRecord.quantity;
    const quantityAfter = quantityBefore + quantityChange;

    db.prepare('UPDATE stock SET quantity = ?, updated_at = ? WHERE id = ?')
      .run(quantityAfter, new Date().toISOString(), stockRecord.id);

    db.prepare(`
      INSERT INTO stock_transactions (product_id, variant_id, transaction_type, reference_type, reference_id,
        quantity_change, quantity_before, quantity_after, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, variantId, transactionType, referenceType, referenceId,
      quantityChange, quantityBefore, quantityAfter, notes, createdBy);

    return quantityAfter;
  });

  return updateFn();
}

function getStockLevel(productId, variantId = null) {
  const db = getDb();
  const record = db.prepare('SELECT quantity FROM stock WHERE product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))')
    .get(productId, variantId, variantId);
  return record ? record.quantity : 0;
}

module.exports = { updateStock, getStockLevel };

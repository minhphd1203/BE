const { query } = require('../config/database');

const Inspection = {
  create: async (inspectionData) => {
    const { bike_id, inspector_id } = inspectionData;
    const result = await query(
      `INSERT INTO inspections (bike_id, inspector_id, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [bike_id, inspector_id]
    );
    return result.rows[0];
  },

  findById: async (id) => {
    const result = await query(
      `SELECT i.*, 
        b.title as bike_title,
        inspector.full_name as inspector_name
      FROM inspections i
      JOIN bikes b ON i.bike_id = b.id
      JOIN users inspector ON i.inspector_id = inspector.id
      WHERE i.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  findByBike: async (bikeId) => {
    const result = await query(
      `SELECT i.*, inspector.full_name as inspector_name
      FROM inspections i
      JOIN users inspector ON i.inspector_id = inspector.id
      WHERE i.bike_id = $1
      ORDER BY i.created_at DESC`,
      [bikeId]
    );
    return result.rows;
  },

  findByInspector: async (inspectorId) => {
    const result = await query(
      `SELECT i.*, b.title as bike_title, seller.full_name as seller_name
      FROM inspections i
      JOIN bikes b ON i.bike_id = b.id
      JOIN users seller ON b.seller_id = seller.id
      WHERE i.inspector_id = $1
      ORDER BY i.created_at DESC`,
      [inspectorId]
    );
    return result.rows;
  },

  update: async (id, updates) => {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    values.push(id);
    
    const result = await query(
      `UPDATE inspections SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Nếu inspection hoàn thành, cập nhật bike
    if (updates.status === 'completed') {
      await query('UPDATE bikes SET is_inspected = true WHERE id = (SELECT bike_id FROM inspections WHERE id = $1)', [id]);
    }

    return result.rows[0];
  },

  getPending: async () => {
    const result = await query(
      `SELECT i.*, b.title as bike_title, seller.full_name as seller_name
      FROM inspections i
      JOIN bikes b ON i.bike_id = b.id
      JOIN users seller ON b.seller_id = seller.id
      WHERE i.status = 'pending'
      ORDER BY i.created_at ASC`
    );
    return result.rows;
  }
};

module.exports = Inspection;

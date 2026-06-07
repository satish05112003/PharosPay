class Beneficiary {
  constructor(db) {
    this.db = db;
  }

  async findById(id) {
    const res = await this.db.query(
      'SELECT * FROM beneficiaries WHERE id = $1',
      [id]
    );
    return res.rows[0];
  }

  async findByIdentifier(country, rail, identifier) {
    const res = await this.db.query(
      'SELECT * FROM beneficiaries WHERE country = $1 AND payment_rail = $2 AND identifier = $3',
      [country, rail, identifier]
    );
    return res.rows[0];
  }

  async create({
    country,
    paymentRail,
    identifier,
    identifierType,
    verifiedName = null,
    verifiedBank = null,
    isVerified = false,
    verificationSource = null,
    metadata = {}
  }) {
    const res = await this.db.query(
      `INSERT INTO beneficiaries (
        country, payment_rail, identifier, identifier_type, verified_name,
        verified_bank, is_verified, verification_source, last_verified_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      RETURNING *`,
      [
        country, paymentRail, identifier, identifierType, verifiedName,
        verifiedBank, isVerified, verificationSource, JSON.stringify(metadata)
      ]
    );
    return res.rows[0];
  }

  async updateVerification(id, { verifiedName, verifiedBank, isVerified, verificationSource }) {
    const res = await this.db.query(
      `UPDATE beneficiaries SET
        verified_name = $2,
        verified_bank = $3,
        is_verified = $4,
        verification_source = $5,
        last_verified_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, verifiedName, verifiedBank, isVerified, verificationSource]
    );
    return res.rows[0];
  }

  async incrementStats(country, rail, identifier, amount) {
    await this.db.query(
      `UPDATE beneficiaries SET
        total_received = total_received + $4,
        transaction_count = transaction_count + 1
      WHERE country = $1 AND payment_rail = $2 AND identifier = $3`,
      [country, rail, identifier, amount]
    );
  }
}

module.exports = Beneficiary;

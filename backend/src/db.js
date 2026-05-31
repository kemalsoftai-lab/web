const db = { users: [], otps: [], signals: [], payments: [] };
function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
module.exports = { db, id };

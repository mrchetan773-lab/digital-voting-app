const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  hasVotedRural: { type: Boolean, default: false },
  hasVotedUrban: { type: Boolean, default: false }
});

const settingsSchema = new mongoose.Schema({
  type: { type: String, default: 'global', unique: true },
  votingOpen: { type: String, default: '2026-08-21T00:00:00' },
  votingClose: { type: String, default: '2026-09-01T00:00:00' },
  ringcaptchaAppKey: { type: String, default: '' },
  ringcaptchaApiKey: { type: String, default: '' },
  smtpHost: { type: String, default: '' },
  smtpPort: { type: Number, default: 587 },
  smtpSecure: { type: Boolean, default: false },
  smtpUser: { type: String, default: '' },
  smtpPass: { type: String, default: '' },
  smtpSender: { type: String, default: '' }
});

const candidateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ['rural', 'urban'], required: true },
  name: { type: String, required: true },
  number: { type: Number, required: true },
  symbol: { type: String, required: true },
  votes: { type: Number, default: 0 }
});

const Member = mongoose.model('Member', memberSchema);
const Settings = mongoose.model('Settings', settingsSchema);
const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = { Member, Settings, Candidate };

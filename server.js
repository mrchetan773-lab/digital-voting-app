const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/digital_voting')
  .then(() => console.log('[DB] Connected to MongoDB'))
  .catch(err => console.error('[DB] MongoDB Connection Error:', err));

// Define Vote Schema
const voteSchema = new mongoose.Schema({
  memberId: { type: String, required: true },
  region: { type: String, enum: ['rural', 'urban', 'nota'], required: true },
  candidates: [String],
  timestamp: { type: Date, default: Date.now }
});
const Vote = mongoose.model('Vote', voteSchema);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Copy the generated background image if it exists in the brain folder
const bgSrc = 'C:/Users/mrche/.gemini/antigravity/brain/dc5fc996-9526-4c28-bb41-9676a6fef3a5/voting_ballot_bg_1787305102995.jpg';
const bgDest = path.join(__dirname, 'public', 'voting_background.jpg');
try {
  if (fs.existsSync(bgSrc)) {
    fs.copyFileSync(bgSrc, bgDest);
    console.log('[Setup] Background image successfully copied to public/voting_background.jpg');
  }
} catch (e) {
  console.error('[Setup] Failed to copy background image:', e.message);
}

// ─────────────────────────────────────────────
// DATA GENERATION — 100 Life Members
// ─────────────────────────────────────────────
const MEMBERS_PATH = path.join(__dirname, 'data', 'members.json');

function generateMembers() {
  const firstNames = [
    'Rajesh','Suresh','Amit','Priya','Sunita','Vikram','Anita','Deepak',
    'Kavita','Manoj','Neha','Ravi','Sanjay','Pooja','Arun','Meena',
    'Kiran','Rahul','Geeta','Ashok','Vivek','Swati','Rohit','Sapna',
    'Nitin','Jaya','Pankaj','Asha','Vinod','Lata'
  ];
  const lastNames = [
    'Kumar','Sharma','Singh','Verma','Gupta','Patel','Das','Joshi',
    'Reddy','Nair','Rao','Mishra','Chauhan','Yadav','Pandey','Mehta',
    'Shah','Jain','Agarwal','Tiwari','Kapoor','Bhatia','Saxena','Iyer',
    'Pillai','Hegde','Rathore','Deshmukh','Kulkarni','Banerjee'
  ];

  const members = [];
  for (let i = 1; i <= 100; i++) {
    const id = `LM${String(i).padStart(4, '0')}`;
    const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
    const phone = i === 1 ? '9876543210' : `9${String(Math.floor(Math.random() * 900000000 + 100000000))}`;
    const hasMissing = Math.random() < 0.3;

    members.push({
      id,
      name: `${fname} ${lname}`,
      phone,
      email: hasMissing ? '' : `${fname.toLowerCase()}.${lname.toLowerCase()}${i}@email.com`,
      address: (hasMissing && Math.random() < 0.5)
        ? ''
        : `${Math.floor(Math.random() * 500 + 1)}, Sector ${Math.floor(Math.random() * 50 + 1)}`,
      hasVoted: false
    });
  }

  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
  return members;
}

let members;
if (fs.existsSync(MEMBERS_PATH)) {
  members = JSON.parse(fs.readFileSync(MEMBERS_PATH, 'utf8'));
  if (members.length > 0 && members[0].phone !== '9876543210') {
    members[0].phone = '9876543210';
    fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
  }
} else {
  members = generateMembers();
}

// ─────────────────────────────────────────────
// IN-MEMORY STATE
// ─────────────────────────────────────────────
// State variables replaced by MongoDB Vote collection
const SETTINGS_PATH = path.join(__dirname, 'data', 'settings.json');
let adminSettings = {
  votingOpen:  '2026-08-21T00:00:00',
  votingClose: '2026-09-01T00:00:00',
  ringcaptchaAppKey: '',
  ringcaptchaApiKey: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  smtpSender: ''
};

const activeOTPs = new Map(); // Store temporary generated codes in-memory

async function sendEmailOTP(toEmail, code) {
  const transporter = nodemailer.createTransport({
    host: adminSettings.smtpHost,
    port: parseInt(adminSettings.smtpPort) || 587,
    secure: adminSettings.smtpSecure === true || adminSettings.smtpSecure === 'true',
    auth: {
      user: adminSettings.smtpUser,
      pass: adminSettings.smtpPass
    }
  });

  const mailOptions = {
    from: adminSettings.smtpSender || adminSettings.smtpUser,
    to: toEmail,
    subject: 'Verification OTP - Digital Voting System',
    text: `Your one-time verification password is: ${code}\n\nThis OTP is valid for 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8; border-radius: 8px;">
        <h2 style="color: #4f8cff; margin-bottom: 20px;">Digital Voting System</h2>
        <p>Your one-time verification password (OTP) is:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #e8edf3; border-radius: 6px; display: inline-block; color: #1f2d3d;">
          ${code}
        </div>
        <p style="margin-top: 20px; font-size: 0.9rem; color: #8899aa;">This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

if (fs.existsSync(SETTINGS_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    adminSettings = { ...adminSettings, ...loaded };
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

// ─────────────────────────────────────────────
// CANDIDATE DATA
// ─────────────────────────────────────────────
const ruralCandidates = [
  { id:'R1',  name:'Arjun Mehra',     number:1,  symbol:'⭐' },
  { id:'R2',  name:'Bharat Singh',    number:2,  symbol:'#️⃣' },
  { id:'R3',  name:'Chandra Devi',    number:3,  symbol:'🔷' },
  { id:'R4',  name:'Dhruv Patel',     number:4,  symbol:'◆' },
  { id:'R5',  name:'Esha Rao',        number:5,  symbol:'▲' },
  { id:'R6',  name:'Farhan Ali',      number:6,  symbol:'●' },
  { id:'R7',  name:'Gita Sharma',     number:7,  symbol:'■' },
  { id:'R8',  name:'Hari Prasad',     number:8,  symbol:'♦' },
  { id:'R9',  name:'Indira Nair',     number:9,  symbol:'♠' },
  { id:'R10', name:'Jai Kumar',       number:10, symbol:'♣' },
  { id:'R11', name:'Kamla Verma',     number:11, symbol:'♥' },
  { id:'R12', name:'Lakshmi Das',     number:12, symbol:'☀' },
  { id:'R13', name:'Mohan Gupta',     number:13, symbol:'🌙' },
  { id:'R14', name:'Nandini Joshi',   number:14, symbol:'⚡' },
  { id:'R15', name:'Om Prakash',      number:15, symbol:'🔔' },
  { id:'R16', name:'Padma Reddy',     number:16, symbol:'🏠' },
  { id:'R17', name:'Qadir Hussain',   number:17, symbol:'🌿' },
  { id:'R18', name:'Rekha Mishra',    number:18, symbol:'🎯' },
  { id:'R19', name:'Sudhir Yadav',    number:19, symbol:'🔑' },
  { id:'R20', name:'Tulsi Pandey',    number:20, symbol:'🛡️' }
];

const urbanCandidates = [
  { id:'U1',  name:'Aarav Kapoor',      number:1,  symbol:'🏢' },
  { id:'U2',  name:'Bhavna Shah',       number:2,  symbol:'🚗' },
  { id:'U3',  name:'Chirag Mehta',      number:3,  symbol:'💡' },
  { id:'U4',  name:'Divya Jain',        number:4,  symbol:'📱' },
  { id:'U5',  name:'Ekta Agarwal',      number:5,  symbol:'🎓' },
  { id:'U6',  name:'Firoz Khan',        number:6,  symbol:'⚖️' },
  { id:'U7',  name:'Gauri Tiwari',      number:7,  symbol:'🏥' },
  { id:'U8',  name:'Hemant Sinha',      number:8,  symbol:'✈️' },
  { id:'U9',  name:'Isha Banerjee',     number:9,  symbol:'🎭' },
  { id:'U10', name:'Jayant Saxena',     number:10, symbol:'🔬' },
  { id:'U11', name:'Kriti Malhotra',    number:11, symbol:'🎵' },
  { id:'U12', name:'Lalit Chauhan',     number:12, symbol:'📚' },
  { id:'U13', name:'Madhuri Iyer',      number:13, symbol:'🏗️' },
  { id:'U14', name:'Nikhil Bhatia',     number:14, symbol:'🌐' },
  { id:'U15', name:'Ojas Deshmukh',     number:15, symbol:'🛒' },
  { id:'U16', name:'Pallavi Kulkarni',  number:16, symbol:'🎨' },
  { id:'U17', name:'Qasim Syed',        number:17, symbol:'⚙️' },
  { id:'U18', name:'Ritika Chopra',     number:18, symbol:'🏆' },
  { id:'U19', name:'Siddharth Menon',   number:19, symbol:'🎪' },
  { id:'U20', name:'Tanvi Hegde',       number:20, symbol:'💼' },
  { id:'U21', name:'Uday Rathore',      number:21, symbol:'🔮' },
  { id:'U22', name:'Vandana Pillai',    number:22, symbol:'🧪' },
  { id:'U23', name:'Waseem Ahmed',      number:23, symbol:'📡' },
  { id:'U24', name:'Xena Rodrigues',    number:24, symbol:'🎲' },
  { id:'U25', name:'Yogesh Patil',      number:25, symbol:'🗳️' },
  { id:'U26', name:'Zoya Sen',          number:26, symbol:'🎸' },
  { id:'U27', name:'Alok Sharma',       number:27, symbol:'🚲' },
  { id:'U28', name:'Bipasha Basu',      number:28, symbol:'🍀' },
  { id:'U29', name:'Chetan Bhagat',     number:29, symbol:'✍️' },
  { id:'U30', name:'Devendra Phadnis',  number:30, symbol:'🏟️' }
];

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────

// ── Authentication by Member ID ──
app.post('/api/auth/id', async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'Member ID is required' });

  const member = members.find(m => m.id.toUpperCase() === memberId.trim().toUpperCase());
  if (!member) {
    return res.status(404).json({ error: 'Member ID not found. Please check and try again.' });
  }

  const hasVotedRural = await Vote.exists({ memberId: member.id, region: 'rural' });
  const hasVotedUrban = await Vote.exists({ memberId: member.id, region: 'urban' });
  const hasVotedNota = await Vote.exists({ memberId: member.id, region: 'nota' });

  if ((hasVotedRural && hasVotedUrban) || hasVotedNota) {
    return res.status(403).json({ error: 'This member has already cast all their votes.' });
  }
  
  // Clone member to avoid mutating the database object directly for this session
  const memberData = { ...member };
  memberData.hasVotedRural = !!hasVotedRural;
  memberData.hasVotedUrban = !!hasVotedUrban;

  const hasMissing = !member.email || !member.address;
  res.json({ member: memberData, hasMissing });
});

// ── Authentication by OTP — Send ──
app.post('/api/auth/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const member = members.find(m => m.phone === phone.trim());
  if (!member) {
    return res.status(404).json({ error: 'Phone number not registered.' });
  }

  const hasVotedRural = await Vote.exists({ memberId: member.id, region: 'rural' });
  const hasVotedUrban = await Vote.exists({ memberId: member.id, region: 'urban' });
  const hasVotedNota = await Vote.exists({ memberId: member.id, region: 'nota' });

  if ((hasVotedRural && hasVotedUrban) || hasVotedNota) {
    return res.status(403).json({ error: 'This member has already cast all their votes.' });
  }

  // If RingCaptcha is configured, use it!
  if (adminSettings.ringcaptchaAppKey && adminSettings.ringcaptchaApiKey) {
    try {
      const params = new URLSearchParams();
      params.append('phone', phone.trim());
      params.append('api_key', adminSettings.ringcaptchaApiKey);

      const ringRes = await fetch(`https://api.ringcaptcha.com/${adminSettings.ringcaptchaAppKey}/code/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const data = await ringRes.json();
      
      if (data.status === 'SUCCESS') {
        console.log(`[OTP] Sent RingCaptcha SMS code for ${phone}, token: ${data.token}`);
        return res.json({ 
          success: true, 
          message: 'Real-time RingCaptcha OTP sent successfully!', 
          token: data.token 
        });
      } else {
        console.error('[OTP] RingCaptcha Send Error:', data);
        return res.status(500).json({ error: data.message || 'Failed to send OTP via RingCaptcha.' });
      }
    } catch (err) {
      console.error('[OTP] RingCaptcha Fetch Error:', err.message);
      return res.status(500).json({ error: 'Network error communicating with RingCaptcha.' });
    }
  }

  // Otherwise, fallback to Mock OTP
  console.log(`[OTP] Sent mock code 1234 to ${phone}`);
  res.json({ 
    success: true, 
    message: 'OTP sent successfully. Use mock code: 1234 (Simulated)', 
    token: 'mock-token' 
  });
});

// ── Authentication by OTP — Verify ──
app.post('/api/auth/otp/verify', async (req, res) => {
  const { phone, otp, token } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  const member = members.find(m => m.phone === phone.trim());
  if (!member) {
    return res.status(404).json({ error: 'Phone number not registered.' });
  }

  const hasVotedRural = await Vote.exists({ memberId: member.id, region: 'rural' });
  const hasVotedUrban = await Vote.exists({ memberId: member.id, region: 'urban' });
  const hasVotedNota = await Vote.exists({ memberId: member.id, region: 'nota' });

  if ((hasVotedRural && hasVotedUrban) || hasVotedNota) {
    return res.status(403).json({ error: 'This member has already cast all their votes.' });
  }

  // If RingCaptcha is configured and token is not mock
  if (adminSettings.ringcaptchaAppKey && adminSettings.ringcaptchaApiKey && token && token !== 'mock-token') {
    try {
      const params = new URLSearchParams();
      params.append('phone', phone.trim());
      params.append('code', otp.trim());
      params.append('token', token.trim());
      params.append('api_key', adminSettings.ringcaptchaApiKey);

      const ringRes = await fetch(`https://api.ringcaptcha.com/${adminSettings.ringcaptchaAppKey}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const data = await ringRes.json();

      if (data.status === 'SUCCESS') {
        console.log(`[OTP] RingCaptcha verification SUCCESS for ${phone}`);
        const hasMissing = !member.email || !member.address;
        const memberData = { ...member, hasVotedRural: !!hasVotedRural, hasVotedUrban: !!hasVotedUrban };
        return res.json({ member: memberData, hasMissing });
      } else {
        console.warn(`[OTP] RingCaptcha verification FAILED for ${phone}:`, data);
        return res.status(401).json({ error: data.message || 'Invalid OTP. Please try again.' });
      }
    } catch (err) {
      console.error('[OTP] RingCaptcha Verify Error:', err.message);
      return res.status(500).json({ error: 'Network error verifying with RingCaptcha.' });
    }
  }

  // Fallback to Mock Verify
  if (otp !== '1234') {
    return res.status(401).json({ error: 'Invalid OTP. Please try again.' });
  }
  const hasMissing = !member.email || !member.address;
  const memberData = { ...member, hasVotedRural: !!hasVotedRural, hasVotedUrban: !!hasVotedUrban };
  res.json({ member: memberData, hasMissing });
});

// ── Authentication by Email OTP — Send ──
app.post('/api/auth/email/send', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required' });

  const member = members.find(m => m.email.toLowerCase() === email.trim().toLowerCase());
  if (!member) {
    return res.status(404).json({ error: 'Email address not registered.' });
  }

  const hasVotedRural = await Vote.exists({ memberId: member.id, region: 'rural' });
  const hasVotedUrban = await Vote.exists({ memberId: member.id, region: 'urban' });
  const hasVotedNota = await Vote.exists({ memberId: member.id, region: 'nota' });

  if ((hasVotedRural && hasVotedUrban) || hasVotedNota) {
    return res.status(403).json({ error: 'This member has already cast all their votes.' });
  }

  // Generate 6-digit OTP code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  activeOTPs.set(email.trim().toLowerCase(), {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes expiration
  });

  // If SMTP is configured, send the real email!
  if (adminSettings.smtpHost && adminSettings.smtpUser && adminSettings.smtpPass) {
    try {
      await sendEmailOTP(email.trim(), code);
      console.log(`[Email OTP] Sent real SMTP email to ${email.trim()} with code: ${code}`);
      return res.json({ success: true, message: 'Real-time Email OTP sent successfully!' });
    } catch (err) {
      console.error('[Email OTP] SMTP Send Error:', err.message);
      return res.status(500).json({ error: 'Failed to send OTP email via SMTP. Please check credentials.' });
    }
  }

  // Otherwise, fallback to Mock Email OTP
  console.log(`[Email OTP] Sent mock email code ${code} to ${email.trim()}`);
  res.json({ 
    success: true, 
    message: `Email OTP sent (Mock Mode). Use code: ${code}`
  });
});

// ── Authentication by Email OTP — Verify ──
app.post('/api/auth/email/verify', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  const member = members.find(m => m.email.toLowerCase() === email.trim().toLowerCase());
  if (!member) {
    return res.status(404).json({ error: 'Email address not registered.' });
  }

  const hasVotedRural = await Vote.exists({ memberId: member.id, region: 'rural' });
  const hasVotedUrban = await Vote.exists({ memberId: member.id, region: 'urban' });
  const hasVotedNota = await Vote.exists({ memberId: member.id, region: 'nota' });

  if ((hasVotedRural && hasVotedUrban) || hasVotedNota) {
    return res.status(403).json({ error: 'This member has already cast all their votes.' });
  }

  // Verify the OTP code
  const record = activeOTPs.get(email.trim().toLowerCase());
  if (!record) {
    return res.status(400).json({ error: 'No active OTP found. Please request a new one.' });
  }

  if (Date.now() > record.expiresAt) {
    activeOTPs.delete(email.trim().toLowerCase());
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.code !== otp.trim()) {
    return res.status(401).json({ error: 'Invalid OTP. Please try again.' });
  }

  // Clean up code on success
  activeOTPs.delete(email.trim().toLowerCase());
  console.log(`[Email OTP] Verification SUCCESS for ${email}`);
  
  const hasMissing = !member.email || !member.address;
  const memberData = { ...member, hasVotedRural: !!hasVotedRural, hasVotedUrban: !!hasVotedUrban };
  res.json({ member: memberData, hasMissing });
});

// ── Update Member Profile ──
app.post('/api/member/update', (req, res) => {
  const { id, email, address } = req.body;
  const member = members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (email)   member.email   = email;
  if (address) member.address = address;
  fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
  res.json({ success: true, member });
});

// ── Get Candidates ──
app.get('/api/candidates', (req, res) => {
  res.json({ rural: ruralCandidates, urban: urbanCandidates });
});

// ── Admin Authentication Middleware ──
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.adminToken;
  if (token === 'session-admin-token-12345') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin authentication required.' });
  }
}

// ── Admin Login Route ──
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, adminToken: 'session-admin-token-12345' });
  } else {
    res.status(401).json({ error: 'Invalid admin username or password.' });
  }
});

// ── Admin: List Members ──
app.get('/api/admin/members', adminAuth, async (req, res) => {
  const search = (req.query.search || '').toLowerCase();
  const filter = (req.query.filter || '').toLowerCase(); // 'voted', 'not-voted', 'nota', or ''
  
  const allVotes = await Vote.find({});
  const votedRuralSet = new Set(allVotes.filter(v => v.region === 'rural').map(v => v.memberId));
  const votedUrbanSet = new Set(allVotes.filter(v => v.region === 'urban').map(v => v.memberId));
  const notaSet = new Set(allVotes.filter(v => v.region === 'nota').map(v => v.memberId));

  let filtered = members;
  if (search) {
    filtered = filtered.filter(m =>
      m.id.toLowerCase().includes(search) ||
      m.name.toLowerCase().includes(search) ||
      m.phone.includes(search)
    );
  }

  // Apply status filter
  if (filter === 'voted') {
    filtered = filtered.filter(m => (votedRuralSet.has(m.id) || votedUrbanSet.has(m.id)) && !notaSet.has(m.id));
  } else if (filter === 'nota') {
    filtered = filtered.filter(m => notaSet.has(m.id));
  } else if (filter === 'not-voted') {
    filtered = filtered.filter(m => !votedRuralSet.has(m.id) && !votedUrbanSet.has(m.id) && !notaSet.has(m.id));
  }

  // Add status to each member
  const membersWithStatus = filtered.slice(0, 200).map(m => ({
    ...m,
    hasVoted: votedRuralSet.has(m.id) || votedUrbanSet.has(m.id),
    hasVotedNota: notaSet.has(m.id),
    status: notaSet.has(m.id) ? 'NOTA' : (votedRuralSet.has(m.id) || votedUrbanSet.has(m.id)) ? 'Voted' : 'Not Voted'
  }));

  res.json({
    members: membersWithStatus,
    total: filtered.length,
    totalAll: members.length,
    totalVoted: members.filter(m => votedRuralSet.has(m.id) || votedUrbanSet.has(m.id)).length,
    totalNota: notaSet.size,
    totalNotVoted: members.filter(m => !votedRuralSet.has(m.id) && !votedUrbanSet.has(m.id) && !notaSet.has(m.id)).length
  });
});

// ── Admin: Add Member ──
app.post('/api/admin/members', adminAuth, (req, res) => {
  const { id, name, phone, email, address } = req.body;
  if (!id || !name || !phone) {
    return res.status(400).json({ error: 'ID, Name, and Phone are required.' });
  }
  // Check duplicate
  if (members.find(m => m.id.toUpperCase() === id.toUpperCase())) {
    return res.status(409).json({ error: `Member ID "${id}" already exists.` });
  }
  if (members.find(m => m.phone === phone)) {
    return res.status(409).json({ error: `Phone "${phone}" already registered.` });
  }
  const newMember = {
    id: id.toUpperCase(),
    name,
    phone,
    email: email || '',
    address: address || '',
    hasVoted: false
  };
  members.push(newMember);
  fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
  res.json({ success: true, member: newMember, totalMembers: members.length });
});

// ── Admin: Delete Member ──
app.delete('/api/admin/members/:id', adminAuth, (req, res) => {
  const idx = members.findIndex(m => m.id.toUpperCase() === req.params.id.toUpperCase());
  if (idx === -1) return res.status(404).json({ error: 'Member not found.' });
  if (members[idx].hasVoted) {
    return res.status(403).json({ error: 'Cannot delete a member who has already voted.' });
  }
  members.splice(idx, 1);
  fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
  res.json({ success: true, totalMembers: members.length });
});

// ── Admin: Reset All Votes ──
app.post('/api/admin/reset-votes', adminAuth, async (req, res) => {
  await Vote.deleteMany({});
  members.forEach(m => {
    m.hasVoted = false;
    m.hasVotedRural = false;
    m.hasVotedUrban = false;
  });
  res.json({ success: true, message: 'All votes have been reset in the database.' });
});

async function sendVoteConfirmation(member) {
  if (member.email && adminSettings.smtpHost && adminSettings.smtpUser && adminSettings.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: adminSettings.smtpHost,
        port: parseInt(adminSettings.smtpPort) || 587,
        secure: adminSettings.smtpSecure === true || adminSettings.smtpSecure === 'true',
        auth: {
          user: adminSettings.smtpUser,
          pass: adminSettings.smtpPass
        }
      });

      const mailOptions = {
        from: adminSettings.smtpSender || adminSettings.smtpUser,
        to: member.email,
        subject: 'Vote Successfully Cast - Digital Voting System',
        text: `Dear ${member.name},\n\nThis is to confirm that your vote (Member ID: ${member.id}) has been successfully cast in the Digital Voting System.\n\nThank you for making your voice count!`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8; border-radius: 8px;">
            <h2 style="color: #22c55e; margin-bottom: 20px;">🗳️ Vote Cast Confirmed</h2>
            <p>Dear <strong>${member.name}</strong>,</p>
            <p>This is to confirm that your vote (Member ID: <strong>${member.id}</strong>) has been successfully recorded in the Digital Voting System.</p>
            <p style="margin-top: 20px; font-weight: bold; color: #4f8cff;">Thank you for participating and making your voice count!</p>
            <p style="margin-top: 20px; font-size: 0.85rem; color: #8899aa; border-top: 1px solid #e8edf3; padding-top: 10px;">This is an automated confirmation email. Please do not reply directly to this message.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Notification] Vote cast confirmation email sent to ${member.email}`);
    } catch (err) {
      console.error('[Notification] Failed to send vote confirmation email:', err.message);
    }
  } else {
    console.log(`[Notification Mock] Vote confirmation triggered for ${member.name} (${member.id}). Registered email: ${member.email || 'None'}`);
  }
}

// ── Submit NOTA Vote ──
app.post('/api/vote/nota', async (req, res) => {
  const { memberId } = req.body;

  if (!memberId) {
    return res.status(400).json({ error: 'Incomplete NOTA vote payload.' });
  }

  const hasVotedRural = await Vote.exists({ memberId, region: 'rural' });
  const hasVotedUrban = await Vote.exists({ memberId, region: 'urban' });
  const hasVotedNota = await Vote.exists({ memberId, region: 'nota' });

  if (hasVotedRural || hasVotedUrban || hasVotedNota) {
    return res.status(403).json({ error: 'This member has already cast their vote.' });
  }

  // Check voting window
  const now   = new Date();
  const open  = new Date(adminSettings.votingOpen);
  const close = new Date(adminSettings.votingClose);
  if (now < open || now > close) {
    return res.status(403).json({ error: 'Voting is not currently open.' });
  }

  await Vote.create({ memberId, region: 'nota' });

  // Mark member
  const member = members.find(m => m.id === memberId);
  if (member) {
    member.hasVoted = true;
    sendVoteConfirmation(member);
  }

  res.json({ success: true, message: 'NOTA recorded successfully!' });
});

// ── Submit Rural Vote ──
app.post('/api/vote/rural', async (req, res) => {
  const { memberId, rural } = req.body;

  if (!memberId || !rural) {
    return res.status(400).json({ error: 'Incomplete rural vote payload.' });
  }
  if (rural.length !== 14) {
    return res.status(400).json({ error: `Rural selection must be exactly 14. Got ${rural.length}.` });
  }

  const hasVotedRural = await Vote.exists({ memberId, region: 'rural' });
  if (hasVotedRural) {
    return res.status(403).json({ error: 'This member has already cast their rural vote.' });
  }

  // Check voting window
  const now   = new Date();
  const open  = new Date(adminSettings.votingOpen);
  const close = new Date(adminSettings.votingClose);
  if (now < open || now > close) {
    return res.status(403).json({ error: 'Voting is not currently open.' });
  }

  // Save vote to MongoDB
  await Vote.create({ memberId, region: 'rural', candidates: rural });

  // Mark member if both are completed (for simpler tracking, though we keep separate sets)
  const member = members.find(m => m.id === memberId);
  if (member) {
    member.hasVotedRural = true;
    member.hasVoted = true;
    if (member.hasVotedUrban) {
       sendVoteConfirmation(member);
    }
  }

  res.json({ success: true, message: 'Rural vote recorded successfully!' });
});

// ── Submit Urban Vote ──
app.post('/api/vote/urban', async (req, res) => {
  const { memberId, urban } = req.body;

  if (!memberId || !urban) {
    return res.status(400).json({ error: 'Incomplete urban vote payload.' });
  }
  if (urban.length !== 16) {
    return res.status(400).json({ error: `Urban selection must be exactly 16. Got ${urban.length}.` });
  }
  const hasVotedUrban = await Vote.exists({ memberId, region: 'urban' });
  if (hasVotedUrban) {
    return res.status(403).json({ error: 'This member has already cast their urban vote.' });
  }

  // Check voting window
  const now   = new Date();
  const open  = new Date(adminSettings.votingOpen);
  const close = new Date(adminSettings.votingClose);
  if (now < open || now > close) {
    return res.status(403).json({ error: 'Voting is not currently open.' });
  }

  // Save vote to MongoDB
  await Vote.create({ memberId, region: 'urban', candidates: urban });

  // Mark member
  const member = members.find(m => m.id === memberId);
  if (member) {
    member.hasVotedUrban = true;
    member.hasVoted = true;
    if (member.hasVotedRural) {
       sendVoteConfirmation(member);
    }
  }

  res.json({ success: true, message: 'Urban vote recorded successfully!' });
});

// ── Get Results (Admin Only) ──
app.get('/api/results', adminAuth, async (req, res) => {
  const allVotes = await Vote.find({});
  
  const ruralVotes = {};
  const urbanVotes = {};
  
  const votedRuralMembers = new Set();
  const votedUrbanMembers = new Set();
  const notaMembers = new Set();
  
  allVotes.forEach(v => {
    if (v.region === 'rural') {
      v.candidates.forEach(cid => { ruralVotes[cid] = (ruralVotes[cid] || 0) + 1; });
      votedRuralMembers.add(v.memberId);
    } else if (v.region === 'urban') {
      v.candidates.forEach(cid => { urbanVotes[cid] = (urbanVotes[cid] || 0) + 1; });
      votedUrbanMembers.add(v.memberId);
    } else if (v.region === 'nota') {
      notaMembers.add(v.memberId);
    }
  });

  const ruralResults = ruralCandidates.map(c => ({
    ...c, votes: ruralVotes[c.id] || 0
  })).sort((a, b) => b.votes - a.votes);

  const urbanResults = urbanCandidates.map(c => ({
    ...c, votes: urbanVotes[c.id] || 0
  })).sort((a, b) => b.votes - a.votes);

  // Let's create a union set for unique voters who voted in at least one
  const uniqueVoters = new Set([...votedRuralMembers, ...votedUrbanMembers, ...notaMembers]);

  res.json({
    rural: ruralResults,
    urban: urbanResults,
    totalVoters: uniqueVoters.size,
    totalVotersRural: votedRuralMembers.size,
    totalVotersUrban: votedUrbanMembers.size,
    totalNota: notaMembers.size,
    totalMembers: members.length
  });
});

// ── Admin Settings ──
app.get('/api/admin/settings', adminAuth, (req, res) => {
  res.json(adminSettings);
});

app.post('/api/admin/settings', adminAuth, (req, res) => {
  const { 
    votingOpen, 
    votingClose, 
    ringcaptchaAppKey, 
    ringcaptchaApiKey,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpSender
  } = req.body;
  if (votingOpen)  adminSettings.votingOpen  = votingOpen;
  if (votingClose) adminSettings.votingClose = votingClose;
  if (ringcaptchaAppKey !== undefined) adminSettings.ringcaptchaAppKey = ringcaptchaAppKey;
  if (ringcaptchaApiKey !== undefined) adminSettings.ringcaptchaApiKey = ringcaptchaApiKey;
  if (smtpHost !== undefined) adminSettings.smtpHost = smtpHost;
  if (smtpPort !== undefined) adminSettings.smtpPort = smtpPort;
  if (smtpSecure !== undefined) adminSettings.smtpSecure = smtpSecure;
  if (smtpUser !== undefined) adminSettings.smtpUser = smtpUser;
  if (smtpPass !== undefined) adminSettings.smtpPass = smtpPass;
  if (smtpSender !== undefined) adminSettings.smtpSender = smtpSender;
  
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(adminSettings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
  res.json({ success: true, settings: adminSettings });
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║   Digital Voting App — Running           ║`);
  console.log(`  ║   http://localhost:${PORT}                  ║`);
  console.log(`  ║   Members loaded: ${String(members.length).padEnd(22)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');
const { Member, Settings, Candidate } = require('./models');

let mongoServer;

const ruralCandidates = [
  { id:'R1', name:'Arjun Mehra', number:1, symbol:'⭐' }, { id:'R2', name:'Bharat Singh', number:2, symbol:'#️⃣' },
  { id:'R3', name:'Chandra Devi', number:3, symbol:'🔷' }, { id:'R4', name:'Dhruv Patel', number:4, symbol:'◆' },
  { id:'R5', name:'Esha Rao', number:5, symbol:'▲' }, { id:'R6', name:'Farhan Ali', number:6, symbol:'●' },
  { id:'R7', name:'Gita Sharma', number:7, symbol:'■' }, { id:'R8', name:'Hari Prasad', number:8, symbol:'♦' },
  { id:'R9', name:'Indira Nair', number:9, symbol:'♠' }, { id:'R10', name:'Jai Kumar', number:10, symbol:'♣' },
  { id:'R11', name:'Kamla Verma', number:11, symbol:'♥' }, { id:'R12', name:'Lakshmi Das', number:12, symbol:'☀' },
  { id:'R13', name:'Mohan Gupta', number:13, symbol:'🌙' }, { id:'R14', name:'Nandini Joshi', number:14, symbol:'⚡' },
  { id:'R15', name:'Om Prakash', number:15, symbol:'🔔' }, { id:'R16', name:'Padma Reddy', number:16, symbol:'🏠' },
  { id:'R17', name:'Qadir Hussain', number:17, symbol:'🌿' }, { id:'R18', name:'Rekha Mishra', number:18, symbol:'🎯' },
  { id:'R19', name:'Sudhir Yadav', number:19, symbol:'🔑' }, { id:'R20', name:'Tulsi Pandey', number:20, symbol:'🛡️' }
];

const urbanCandidates = [
  { id:'U1', name:'Aarav Kapoor', number:1, symbol:'🏢' }, { id:'U2', name:'Bhavna Shah', number:2, symbol:'🚗' },
  { id:'U3', name:'Chirag Mehta', number:3, symbol:'💡' }, { id:'U4', name:'Divya Jain', number:4, symbol:'📱' },
  { id:'U5', name:'Ekta Agarwal', number:5, symbol:'🎓' }, { id:'U6', name:'Firoz Khan', number:6, symbol:'⚖️' },
  { id:'U7', name:'Gauri Tiwari', number:7, symbol:'🏥' }, { id:'U8', name:'Hemant Sinha', number:8, symbol:'✈️' },
  { id:'U9', name:'Isha Banerjee', number:9, symbol:'🎭' }, { id:'U10', name:'Jayant Saxena', number:10, symbol:'🔬' },
  { id:'U11', name:'Kriti Malhotra', number:11, symbol:'🎵' }, { id:'U12', name:'Lalit Chauhan', number:12, symbol:'📚' },
  { id:'U13', name:'Madhuri Iyer', number:13, symbol:'🏗️' }, { id:'U14', name:'Nikhil Bhatia', number:14, symbol:'🌐' },
  { id:'U15', name:'Ojas Deshmukh', number:15, symbol:'🛒' }, { id:'U16', name:'Pallavi Kulkarni', number:16, symbol:'🎨' },
  { id:'U17', name:'Qasim Syed', number:17, symbol:'⚙️' }, { id:'U18', name:'Ritika Chopra', number:18, symbol:'🏆' },
  { id:'U19', name:'Siddharth Menon', number:19, symbol:'🎪' }, { id:'U20', name:'Tanvi Hegde', number:20, symbol:'💼' },
  { id:'U21', name:'Uday Rathore', number:21, symbol:'🔮' }, { id:'U22', name:'Vandana Pillai', number:22, symbol:'🧪' },
  { id:'U23', name:'Waseem Ahmed', number:23, symbol:'📡' }, { id:'U24', name:'Xena Rodrigues', number:24, symbol:'🎲' },
  { id:'U25', name:'Yogesh Patil', number:25, symbol:'🗳️' }, { id:'U26', name:'Zoya Sen', number:26, symbol:'🎸' },
  { id:'U27', name:'Alok Sharma', number:27, symbol:'🚲' }, { id:'U28', name:'Bipasha Basu', number:28, symbol:'🍀' },
  { id:'U29', name:'Chetan Bhagat', number:29, symbol:'✍️' }, { id:'U30', name:'Devendra Phadnis', number:30, symbol:'🏟️' }
];

async function connectDB() {
  let mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.log('[MongoDB] No MONGO_URI provided in .env, starting in-memory MongoDB...');
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
  }

  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(`[MongoDB] Connected to ${mongoUri}`);

  await initializeData();
}

async function initializeData() {
  // Check if candidates exist
  const candCount = await Candidate.countDocuments();
  if (candCount === 0) {
    console.log('[MongoDB] Initializing candidates...');
    const rural = ruralCandidates.map(c => ({ ...c, type: 'rural' }));
    const urban = urbanCandidates.map(c => ({ ...c, type: 'urban' }));
    await Candidate.insertMany([...rural, ...urban]);
  }

  // Check if settings exist
  let settings = await Settings.findOne({ type: 'global' });
  if (!settings) {
    console.log('[MongoDB] Initializing settings...');
    settings = new Settings({ type: 'global' });
    const localSettingsPath = path.join(__dirname, 'data', 'settings.json');
    if (fs.existsSync(localSettingsPath)) {
      const localData = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
      Object.assign(settings, localData);
    }
    await settings.save();
  }

  // Check if members exist
  const memCount = await Member.countDocuments();
  if (memCount === 0) {
    console.log('[MongoDB] Initializing members...');
    const localMembersPath = path.join(__dirname, 'data', 'members.json');
    let membersToInsert = [];
    if (fs.existsSync(localMembersPath)) {
      membersToInsert = JSON.parse(fs.readFileSync(localMembersPath, 'utf8'));
    } else {
      // Generate if neither exists
      const firstNames = ['Rajesh','Suresh','Amit','Priya','Sunita','Vikram','Anita','Deepak','Kavita','Manoj','Neha','Ravi','Sanjay','Pooja','Arun','Meena','Kiran','Rahul','Geeta','Ashok','Vivek','Swati','Rohit','Sapna','Nitin','Jaya','Pankaj','Asha','Vinod','Lata'];
      const lastNames = ['Kumar','Sharma','Singh','Verma','Gupta','Patel','Das','Joshi','Reddy','Nair','Rao','Mishra','Chauhan','Yadav','Pandey','Mehta','Shah','Jain','Agarwal','Tiwari','Kapoor','Bhatia','Saxena','Iyer','Pillai','Hegde','Rathore','Deshmukh','Kulkarni','Banerjee'];
      
      for (let i = 1; i <= 2050; i++) {
        const id = `LM${String(i).padStart(4, '0')}`;
        const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
        const phone = i === 1 ? '9876543210' : `9${String(Math.floor(Math.random() * 900000000 + 100000000))}`;
        const hasMissing = Math.random() < 0.3;

        membersToInsert.push({
          id,
          name: `${fname} ${lname}`,
          phone,
          email: hasMissing ? '' : `${fname.toLowerCase()}.${lname.toLowerCase()}${i}@email.com`,
          address: (hasMissing && Math.random() < 0.5) ? '' : `${Math.floor(Math.random() * 500 + 1)}, Sector ${Math.floor(Math.random() * 50 + 1)}`,
          hasVotedRural: false,
          hasVotedUrban: false
        });
      }
    }
    
    // Batch insert
    await Member.insertMany(membersToInsert);
    console.log(`[MongoDB] Initialized ${membersToInsert.length} members.`);
  }
}

module.exports = { connectDB };

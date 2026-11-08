import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Restaurant, Branch, User } from './models.js';
const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 8) {
  console.error('Usage: npm run create-owner -- "Restaurant Name" owner@email.com "password-8+chars"'); process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI);
if (await User.findOne({ email: email.toLowerCase() })) { console.error('That email already exists'); process.exit(1); }
const r = await Restaurant.create({ name });
const b = await Branch.create({ restaurant: r._id, name: 'Main Branch' });
await User.create({ restaurant: r._id, branch: b._id, name: 'Owner', email, role: 'owner', passwordHash: await bcrypt.hash(password, 10) });
console.log(`Owner created. Log in with ${email}`);
await mongoose.disconnect();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ALL_ROLES, ROLES } from "../utils/roles.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ALL_ROLES, default: ROLES.USER },
  phone: String,
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre("save", async function(next){
  if(!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(pw){
  return bcrypt.compare(pw, this.password);
};

export default mongoose.model("User", userSchema);

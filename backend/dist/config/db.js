import mongoose from 'mongoose';
export async function connectToDatabase(mongoUri) {
    await mongoose.connect(mongoUri);
}

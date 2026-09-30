const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Buffering disable aur timeout badhane ke liye options
    mongoose.set('bufferCommands', false);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds wait karega cold start ke liye
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
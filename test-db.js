import mongoose from "mongoose";

const uri = "mongodb+srv://cchavez95:H7ZcM79LpXLLrLh6@softplaycluster.rswk2.mongodb.net/softplayDB";

async function run() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const reservas = await db.collection("reservas").find().sort({ _id: -1 }).limit(5).toArray();
    console.log(JSON.stringify(reservas, null, 2));
    process.exit(0);
}

run().catch(console.error);

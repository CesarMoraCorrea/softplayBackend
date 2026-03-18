import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const checkIndexes = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const indexes = await db.collection("reservas").indexes();
    console.log("Índices actuales en 'reservas':");
    console.log(JSON.stringify(indexes, null, 2));

    const ttlIndex = indexes.find(i => i.name === "createdAt_1");
    if (ttlIndex && (!ttlIndex.partialFilterExpression || Object.keys(ttlIndex.partialFilterExpression).length === 0)) {
        console.log("Borrando índice TTL antiguo sin partialFilter...");
        await db.collection("reservas").dropIndex("createdAt_1");
        console.log("Índice borrado con éxito. Al reiniciar el backend, Mongoose creará el índice correcto.");
    } else {
        console.log("El índice TTL es correcto o no existe.");
    }

    process.exit(0);
};

checkIndexes().catch(err => {
    console.error(err);
    process.exit(1);
});

import axios from "axios";

const API_URL = "http://localhost:5000/api";

const checkAPI = async () => {
  try {
    console.log("Verificando API de sedes y escenarios...\n");

    // 1. Obtener lista de sedes con view=escenarios para una sede específica
    const sedeId = "699b6838f84576e34178aed5"; // Cancha La Bombonera
    
    console.log(`📍 Buscando escenarios para Sede ID: ${sedeId}\n`);
    
    const response = await axios.get(`${API_URL}/sedes`, {
      params: {
        view: "escenarios",
        sedeId: sedeId
      }
    });

    const escenarios = response.data;
    console.log(`✓ Respuesta recibida: ${escenarios.length} escenarios\n`);

    escenarios.forEach((esc, idx) => {
      console.log(`Escenario ${idx + 1}:`);
      console.log(`  _id: ${esc._id}`);
      console.log(`  escenarioId: ${esc.escenarioId}`);
      console.log(`  sedeId: ${esc.sedeId}`);
      console.log(`  nombre: ${esc.nombre}`);
      console.log(`  precioHora: ${esc.precioHora}\n`);
    });

    // 2. Intentar obtener un escenario específico
    if (escenarios.length > 0) {
      const escenarioId = escenarios[0].escenarioId;
      console.log(`\n📌 Probando GET /sedes/escenarios/${escenarioId}\n`);
      
      const detalle = await axios.get(`${API_URL}/sedes/escenarios/${escenarioId}`);
      console.log("Respuesta del detalle:");
      console.log(JSON.stringify(detalle.data, null, 2));
    }

  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
};

checkAPI();

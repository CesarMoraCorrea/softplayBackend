import Sede from "../models/Sede.js";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (text) => {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remover tildes y acentos
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeSedePayload = (payload, userId) => {
  const lat = payload?.ubicacion?.coordenadas?.coordinates?.[1] ?? payload?.ubicacion?.lat ?? payload?.lat;
  const lng = payload?.ubicacion?.coordenadas?.coordinates?.[0] ?? payload?.ubicacion?.lng ?? payload?.lng;

  const direccion = payload?.ubicacion?.direccion || payload?.direccion || "Dirección no especificada";
  const barrio = payload?.ubicacion?.barrio || payload?.barrio || "Sin barrio";

  const escenarios = Array.isArray(payload?.escenarios) && payload.escenarios.length
    ? payload.escenarios.map((esc) => ({
        ...esc,
        // Asegurar que cada escenario tenga _id (Mongoose lo generará al guardar si no existe)
        nombre: esc.nombre || "Escenario principal",
        tipoDeporte: esc.tipoDeporte || "Fútbol",
        superficie: esc.superficie || "Sintética",
        precioPorHora: toNumber(esc.precioPorHora, 0),
        activo: esc.activo !== false,
      }))
    : [{
        nombre: payload?.nombre || "Escenario principal",
        tipoDeporte: payload?.tipoCancha || payload?.tipoDeporte || "Fútbol",
        superficie: payload?.superficie || "Sintética",
        precioPorHora: toNumber(payload?.precioHora, 0),
        activo: payload?.activa ?? true
      }];

  return {
    nombre: payload?.nombre,
    ubicacion: {
      direccion,
      barrio,
      coordenadas: {
        type: "Point",
        coordinates: [toNumber(lng), toNumber(lat)]
      }
    },
    servicios: payload?.servicios || [],
    escenarios,
    activa: payload?.activa ?? true,
    propietario: userId
  };
};

const flattenSedeEscenarios = (sedeDoc) => {
  const sede = sedeDoc.toObject ? sedeDoc.toObject() : sedeDoc;
  const coordinates = sede?.ubicacion?.coordenadas?.coordinates || [];
  const lng = coordinates[0];
  const lat = coordinates[1];

  return (sede.escenarios || [])
    .filter((escenario) => escenario.activo !== false)
    .map((escenario) => ({
      _id: String(escenario._id),
      escenarioId: String(escenario._id),
      sedeId: String(sede._id),
      nombre: `${sede.nombre} - ${escenario.nombre}`,
      direccion: sede?.ubicacion?.direccion,
      barrio: sede?.ubicacion?.barrio,
      ubicacion: { lat, lng },
      precioHora: escenario.precioPorHora,
      tipoCancha: escenario.tipoDeporte,
      superficie: escenario.superficie,
      servicios: sede.servicios || [],
      horarios: [],
      imagenes: []
    }));
};

export const createSede = async (req, res) => {
  try {
    const payload = normalizeSedePayload(req.body, req.user?._id);
    const sede = await Sede.create(payload);
    res.json(sede);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const listSedes = async (req, res) => {
  try {
    const {
      q,
      minPrice,
      maxPrice,
      fieldType,
      services,
      lat,
      lng,
      radius,
      view,
      sedeId // Nuevo parámetro para filtrar escenarios por sede
    } = req.query;

    const sedes = await Sede.find({ activa: true }).sort({ createdAt: -1 }).limit(150);

    if (view === "escenarios") {
      let escenarios = sedes.flatMap(flattenSedeEscenarios);

      // Filtrar por sedeId si se proporciona
      if (sedeId) {
        escenarios = escenarios.filter((item) => String(item.sedeId) === String(sedeId));
      }

      if (q) {
        const term = normalizeText(q);
        escenarios = escenarios.filter((item) =>
          [item.nombre, item.direccion, item.barrio, item.tipoCancha]
            .filter(Boolean)
            .some((field) => normalizeText(field).includes(term))
        );
      }

      const min = toNumber(minPrice, 0);
      const max = toNumber(maxPrice, Number.MAX_SAFE_INTEGER);
      escenarios = escenarios.filter((item) => item.precioHora >= min && item.precioHora <= max);

      if (fieldType) {
        const types = String(fieldType)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (types.length) {
          escenarios = escenarios.filter((item) => types.includes(item.tipoCancha));
        }
      }

      if (services) {
        const requiredServices = String(services)
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);

        if (requiredServices.length) {
          escenarios = escenarios.filter((item) => {
            const available = (item.servicios || []).map((service) => String(service).toLowerCase());
            return requiredServices.every((service) => available.includes(service));
          });
        }
      }

      const userLat = Number(lat);
      const userLng = Number(lng);
      const maxRadius = toNumber(radius, 999999);
      if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
        escenarios = escenarios
          .map((item) => ({
            ...item,
            distanciaKm: Number.isFinite(item.ubicacion?.lat) && Number.isFinite(item.ubicacion?.lng)
              ? haversineKm(userLat, userLng, item.ubicacion.lat, item.ubicacion.lng)
              : null
          }))
          .filter((item) => item.distanciaKm === null || item.distanciaKm <= maxRadius)
          .sort((a, b) => {
            if (a.distanciaKm === null) return 1;
            if (b.distanciaKm === null) return -1;
            return a.distanciaKm - b.distanciaKm;
          });
      }

      return res.json(escenarios);
    }

    let sedesPayload = sedes.map((doc) => {
      const sede = doc.toObject ? doc.toObject() : doc;
      const coordinates = sede?.ubicacion?.coordenadas?.coordinates || [];
      const lngCoord = coordinates[0];
      const latCoord = coordinates[1];
      return {
        ...sede,
        ubicacion: {
          ...sede.ubicacion,
          lat: latCoord,
          lng: lngCoord
        },
        escenarios: (sede.escenarios || []).filter((escenario) => escenario.activo !== false)
      };
    });

    if (q) {
      const term = normalizeText(q);
      // Filtrar y ordenar por relevancia
      sedesPayload = sedesPayload
        .map((item) => {
          let relevancia = 0;
          
          // Búsqueda exacta en nombre: relevancia alta
          if (normalizeText(item.nombre).includes(term)) {
            relevancia += 100;
          }
          
          // Búsqueda en dirección: relevancia media
          if (normalizeText(item.ubicacion?.direccion || "").includes(term)) {
            relevancia += 50;
          }
          
          // Búsqueda en barrio: relevancia media
          if (normalizeText(item.ubicacion?.barrio || "").includes(term)) {
            relevancia += 50;
          }
          
          // Búsqueda en tipoDeporte de escenarios: relevancia media-baja
          const tiposDeDeporte = (item.escenarios || []).map((e) => e.tipoDeporte);
          if (tiposDeDeporte.some((tipo) => normalizeText(tipo).includes(term))) {
            relevancia += 75;
          }
          
          return { ...item, relevancia };
        })
        .filter((item) => item.relevancia > 0) // Solo sedes con al menos una coincidencia
        .sort((a, b) => b.relevancia - a.relevancia); // Ordenar por relevancia descendente
    }

    const min = toNumber(minPrice, 0);
    const max = toNumber(maxPrice, Number.MAX_SAFE_INTEGER);
    sedesPayload = sedesPayload.filter((sede) =>
      (sede.escenarios || []).some((escenario) => escenario.precioPorHora >= min && escenario.precioPorHora <= max)
    );

    if (fieldType) {
      const types = String(fieldType)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (types.length) {
        sedesPayload = sedesPayload.filter((sede) =>
          (sede.escenarios || []).some((escenario) => types.includes(escenario.tipoDeporte))
        );
      }
    }

    if (services) {
      const requiredServices = String(services)
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      if (requiredServices.length) {
        sedesPayload = sedesPayload.filter((item) => {
          const available = (item.servicios || []).map((service) => String(service).toLowerCase());
          return requiredServices.every((service) => available.includes(service));
        });
      }
    }

    const userLat = Number(lat);
    const userLng = Number(lng);
    const maxRadius = toNumber(radius, 999999);
    if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
      sedesPayload = sedesPayload
        .map((item) => ({
          ...item,
          distanciaKm: Number.isFinite(item.ubicacion?.lat) && Number.isFinite(item.ubicacion?.lng)
            ? haversineKm(userLat, userLng, item.ubicacion.lat, item.ubicacion.lng)
            : null
        }))
        .filter((item) => item.distanciaKm === null || item.distanciaKm <= maxRadius)
        .sort((a, b) => {
          if (a.distanciaKm === null) return 1;
          if (b.distanciaKm === null) return -1;
          return a.distanciaKm - b.distanciaKm;
        });
    }

    res.json(sedesPayload);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getSede = async (req, res) => {
  try {
    const sede = await Sede.findById(req.params.id);
    if (!sede) return res.status(404).json({ message: "Sede no encontrada" });
    res.json(sede);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getEscenario = async (req, res) => {
  try {
    const escenarioIdParam = req.params.id;
    const sede = await Sede.findOne({ "escenarios._id": escenarioIdParam });
    if (!sede) return res.status(404).json({ message: "Escenario no encontrado" });

    // Buscar escenario por ID dentro de escenarios array
    const escenario = sede.escenarios.find(
      (esc) => String(esc._id) === String(escenarioIdParam)
    );
    if (!escenario) return res.status(404).json({ message: "Escenario no encontrado" });

    const coordinates = sede?.ubicacion?.coordenadas?.coordinates || [];
    res.json({
      _id: String(escenario._id),
      escenarioId: String(escenario._id),
      sedeId: String(sede._id),
      sedeNombre: sede.nombre,
      nombre: escenario.nombre,
      direccion: sede?.ubicacion?.direccion,
      barrio: sede?.ubicacion?.barrio,
      ubicacion: {
        lat: coordinates[1],
        lng: coordinates[0]
      },
      precioHora: escenario.precioPorHora,
      tipoCancha: escenario.tipoDeporte,
      superficie: escenario.superficie,
      servicios: sede.servicios || [],
      imagenes: []
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const updateSede = async (req, res) => {
  try {
    const payload = normalizeSedePayload(req.body, req.user?._id);
    const sede = await Sede.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!sede) return res.status(404).json({ message: "Sede no encontrada" });
    res.json(sede);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const deleteSede = async (req, res) => {
  try {
    await Sede.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
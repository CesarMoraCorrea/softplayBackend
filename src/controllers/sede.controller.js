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

const parseHorarioPorDia = (horarioInput) => {
  if (Array.isArray(horarioInput) && horarioInput.length === 7) {
    return horarioInput.map(dia => ({
      isAbierto: dia.isAbierto ?? true,
      apertura: dia.apertura || "06:00",
      cierre: dia.cierre || "22:00",
      descansos: Array.isArray(dia.descansos) ? dia.descansos.map(d => ({
        inicio: d.inicio,
        fin: d.fin
      })).filter(d => d.inicio && d.fin) : []
    }));
  }
  return Array(7).fill({ isAbierto: true, apertura: "06:00", cierre: "22:00", descansos: [] });
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

const filterBySchedule = (item, dateStr, timeSlotsStr) => {
  if (!dateStr && !timeSlotsStr) return true;

  // Si es un escenario y explícitamente NO usa horario personalizado, forzamos usar el de la Sede
  let config;
  if (item.escenarioId) {
    config = (item.usarHorarioPersonalizado && item.configuracionHorario) 
      ? item.configuracionHorario 
      : item.configuracionHorarioSede;
  } else {
    config = item.configuracionHorario;
  }

  // Fallback final
  if (!config) config = item.configuracionHorario || item.configuracionHorarioSede;
  if (!config || !Array.isArray(config.horarioPorDia)) return true;

  let dayIndex = -1;
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // Create local date at noon to completely eliminate timezone shifting bugs
      const dateObj = new Date(parts[0], parseInt(parts[1]) - 1, parts[2], 12, 0, 0);
      if (!isNaN(dateObj.getTime())) {
        dayIndex = dateObj.getDay(); // JS getDay: 0=Domingo, 1=Lunes. Coincide exactamente con el array de DB.
      }
    }
  }

  const slots = timeSlotsStr ? String(timeSlotsStr).split(",").map(s => s.trim()) : [];

  const checkDayConfig = (dayConfig) => {
    if (!dayConfig || !dayConfig.isAbierto) return false;
    
    if (slots.length > 0) {
      const ap = parseInt(dayConfig.apertura.split(':')[0]) || 6;
      const ci = parseInt(dayConfig.cierre.split(':')[0]) || 22;

      let matchesSlot = false;
      if (slots.includes("Mañana (6-12h)") && ap < 12 && ci > 6) matchesSlot = true;
      if (slots.includes("Tarde (12-18h)") && ap < 18 && ci > 12) matchesSlot = true;
      if (slots.includes("Noche (18-24h)") && ap < 24 && ci > 18) matchesSlot = true;

      if (!matchesSlot) return false;
    }
    return true;
  };

  if (dayIndex >= 0 && dayIndex < 7) {
    // Si se exigió una fecha, verificamos exclusivamente el horario de ese día
    return checkDayConfig(config.horarioPorDia[dayIndex]);
  } else if (slots.length > 0) {
    // Si NO se exigió fecha pero SÍ un horario (ej: Mañana), 
    // validamos que la sede abra en ese horario al menos 1 día a la semana.
    return config.horarioPorDia.some(dayConfig => checkDayConfig(dayConfig));
  }
  
  return true;
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
      imagenes: Array.isArray(esc.imagenes) ? esc.imagenes : [],
      usarHorarioPersonalizado: esc.usarHorarioPersonalizado === true,
      configuracionHorario: esc.usarHorarioPersonalizado ? {
        horarioPorDia: parseHorarioPorDia(esc.configuracionHorario?.horarioPorDia),
        intervaloMinutos: Number(esc.configuracionHorario?.intervaloMinutos) === 30 ? 30 : 60
      } : undefined
    }))
    : [{
      nombre: payload?.nombre || "Escenario principal",
      tipoDeporte: payload?.tipoCancha || payload?.tipoDeporte || "Fútbol",
      superficie: payload?.superficie || "Sintética",
      precioPorHora: toNumber(payload?.precioHora, 0),
      activo: payload?.activa ?? true,
      imagenes: Array.isArray(payload?.imagenesEscenario) ? payload.imagenesEscenario : [],
      usarHorarioPersonalizado: false
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
    imagenes: Array.isArray(payload?.imagenes) ? payload.imagenes : [],
    configuracionHorario: {
      horarioPorDia: parseHorarioPorDia(payload?.configuracionHorario?.horarioPorDia),
      intervaloMinutos: Number(payload?.configuracionHorario?.intervaloMinutos) === 30 ? 30 : 60
    },
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
      configuracionHorarioSede: sede.configuracionHorario,
      usarHorarioPersonalizado: escenario.usarHorarioPersonalizado,
      configuracionHorario: escenario.configuracionHorario,
      horarios: [],
      imagenes: escenario.imagenes || []
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
      sedeId, // Nuevo parámetro para filtrar escenarios por sede
      location,
      timeSlot,
      date,
      minRating
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

      if (location && (!lat || !lng)) {
        const termLoc = normalizeText(location);
        escenarios = escenarios.filter((item) =>
          [item.direccion, item.barrio].filter(Boolean).some((field) => normalizeText(field).includes(termLoc))
        );
      }

      if (minRating) {
        const rating = toNumber(minRating, 0);
        if (rating > 0) {
          escenarios = escenarios.filter((item) => {
            const sedeOrig = sedes.find(s => String(s._id) === item.sedeId);
            const calificacion = sedeOrig?.calificacion || sedeOrig?.calificacionGlobal || 0;
            return calificacion >= rating;
          });
        }
      }

      if (date || timeSlot) {
        escenarios = escenarios.filter((item) => filterBySchedule(item, date, timeSlot));
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

    if (location && (!lat || !lng)) {
      const termLoc = normalizeText(location);
      sedesPayload = sedesPayload.filter(item => 
        [item.ubicacion?.direccion, item.ubicacion?.barrio].filter(Boolean).some(field => normalizeText(field).includes(termLoc))
      );
    }

    if (minRating) {
      const rating = toNumber(minRating, 0);
      if (rating > 0) {
        sedesPayload = sedesPayload.filter((sede) => (sede.calificacion || sede.calificacionGlobal || 0) >= rating);
      }
    }

    if (date || timeSlot) {
      sedesPayload = sedesPayload.filter((sede) => filterBySchedule(sede, date, timeSlot));
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
      configuracionHorarioSede: sede.configuracionHorario,
      usarHorarioPersonalizado: escenario.usarHorarioPersonalizado,
      configuracionHorario: escenario.configuracionHorario,
      imagenes: (escenario.imagenes && escenario.imagenes.length > 0)
        ? escenario.imagenes
        : (sede.imagenes || [])
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
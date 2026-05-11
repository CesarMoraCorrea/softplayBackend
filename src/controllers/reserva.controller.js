import Reserva from "../models/Reserva.js";
import Sede from "../models/Sede.js";
import { ROLES } from "../utils/roles.js";

const parseTimeMinutes = (time) => {
  if (!time || typeof time !== "string" || !time.includes(":")) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const minutesToHHmm = (minutes) => {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mins = String(normalized % 60).padStart(2, "0");
  return `${hours}:${mins}`;
};

const computeDurationHours = (horaInicio, horaFin) => {
  const start = parseTimeMinutes(horaInicio);
  const end = parseTimeMinutes(horaFin);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
};

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    if (typeof value.$oid === "string") return value.$oid.trim();
    if (typeof value.toString === "function") {
      const parsed = value.toString();
      return parsed && parsed !== "[object Object]" ? parsed.trim() : "";
    }
  }
  return "";
};

const normalizeReservaOutput = (reserva, sede, escenario) => {
  const coordinates = sede?.ubicacion?.coordenadas?.coordinates || [];
  const horas = computeDurationHours(reserva.horaInicio, reserva.horaFin);
  const estado = reserva.paymentStatus === "canceled"
    ? "cancelada"
    : reserva.estadoPago === "pagado"
      ? "pagada"
      : "pendiente";

  return {
    ...reserva,
    sede: sede ? {
      _id: sede._id,
      nombre: sede.nombre,
      ubicacion: sede.ubicacion,
      servicios: sede.servicios || []
    } : null,
    escenario: escenario ? {
      _id: escenario._id,
      nombre: escenario.nombre,
      tipoDeporte: escenario.tipoDeporte,
      superficie: escenario.superficie,
      precioPorHora: escenario.precioPorHora
    } : null,
    cancha: escenario ? {
      _id: escenario._id,
      nombre: `${sede?.nombre || "Sede"} - ${escenario.nombre}`,
      ubicacion: { lat: coordinates[1], lng: coordinates[0] },
      tipoCancha: escenario.tipoDeporte,
      precioHora: escenario.precioPorHora,
      imagen: escenario.imagenes?.[0] || sede?.imagenes?.[0] || null
    } : null,
    horas,
    estado
  };
};

const buildReservaDetails = async (reservaDoc) => {
  const reserva = reservaDoc.toObject ? reservaDoc.toObject() : reservaDoc;
  const sede = await Sede.findById(reserva.sede).lean();
  const escenario = sede?.escenarios?.find((item) => String(item._id) === String(reserva.escenario));
  return normalizeReservaOutput(reserva, sede, escenario);
};

export const crearReserva = async (req, res) => {
  try {
    const {
      sedeId,
      escenarioId,
      fecha,
      horaInicio,
      horaFin,
      horas
    } = req.body;

    const resolvedSedeId = normalizeId(sedeId);
    const resolvedEscenarioId = normalizeId(escenarioId);

    if (!resolvedSedeId) {
      return res.status(400).json({ message: "Debes enviar la sede a reservar" });
    }

    if (!resolvedEscenarioId) {
      return res.status(400).json({ message: "Debes enviar el escenario a reservar" });
    }

    console.log(`[crearReserva] Buscando: sedeId=${resolvedSedeId}, escenarioId=${resolvedEscenarioId}`);

    const sede = await Sede.findById(resolvedSedeId);

    if (!sede) return res.status(404).json({ message: "Sede no existe" });

    console.log(`[crearReserva] Sede encontrada: ${sede.nombre}, escenarios disponibles:`,
      sede.escenarios.map(e => ({ id: String(e._id), nombre: e.nombre }))
    );

    // Buscar escenario por ID dentro de escenarios array
    let escenario = sede.escenarios.find(
      (esc) => String(esc._id) === String(resolvedEscenarioId)
    );

    if (!escenario) {
      console.error(`[crearReserva] Escenario no encontrado. SedeId: ${resolvedSedeId}, EscenarioId: ${resolvedEscenarioId}`);
      console.error(`[crearReserva] Escenarios disponibles en sede:`, sede.escenarios.map(e => ({ id: String(e._id), nombre: e.nombre })));
      return res.status(404).json({ message: "Escenario no existe en la sede" });
    }

    if (!escenario.activo) {
      return res.status(400).json({ message: "El escenario no está activo" });
    }

    const baseDate = fecha ? new Date(fecha) : null;
    if (!baseDate || Number.isNaN(baseDate.getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    const startTime = horaInicio || `${String(baseDate.getHours()).padStart(2, "0")}:${String(baseDate.getMinutes()).padStart(2, "0")}`;
    const endTime = horaFin || minutesToHHmm(parseTimeMinutes(startTime) + Number(horas || 1) * 60);

    const startMins = parseTimeMinutes(startTime);
    const endMins = parseTimeMinutes(endTime);

    if (startMins === null || endMins === null || startMins >= endMins) {
      return res.status(400).json({ message: "El rango de horas no es válido" });
    }

    const formattedStartTime = minutesToHHmm(startMins);
    const formattedEndTime = minutesToHHmm(endMins);

    const durationHours = (endMins - startMins) / 60;
    if (durationHours <= 0) {
      return res.status(400).json({ message: "El rango de horas no es válido" });
    }

    const reservaDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

    // Validación de fecha y hora pasada
    const now = new Date();
    const reservaDateTime = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate(), Math.floor(startMins / 60), startMins % 60);

    if (reservaDateTime < now) {
      return res.status(400).json({ message: "No se puede reservar en una fecha y hora pasada" });
    }

    // Validación de solapamiento de horarios en la misma cancha
    const conflictingReserva = await Reserva.findOne({
      escenario: escenario._id,
      fecha: reservaDate,
      paymentStatus: { $ne: "canceled" }, // Ignoramos las reservas canceladas
      $and: [
        { horaInicio: { $lt: formattedEndTime } },
        { horaFin: { $gt: formattedStartTime } }
      ]
    });

    if (conflictingReserva) {
      return res.status(400).json({ message: "Este horario ya se encuentra reservado o se cruza con otra reserva." });
    }

    const total = (escenario.precioPorHora || 0) * durationHours;

    const reserva = await Reserva.create({
      usuario: req.user._id,
      sede: sede._id,
      escenario: escenario._id,
      fecha: reservaDate,
      horaInicio: formattedStartTime,
      horaFin: formattedEndTime,
      total,
      estadoPago: "pendiente"
    });

    const response = await buildReservaDetails(reserva);
    res.json(response);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const crearReservaBloqueada = async (req, res) => {
  try {
    const { sedeId, escenarioId, fecha, horaInicio, horaFin, horas } = req.body;

    // 1. Exactamente misma lógica de formato de fechas de crearReserva original
    const resolvedSedeId = normalizeId(sedeId);
    const resolvedEscenarioId = normalizeId(escenarioId);
    if (!resolvedSedeId || !resolvedEscenarioId) return res.status(400).json({ message: "Faltan datos de Sede o Escenario" });

    const sede = await Sede.findById(resolvedSedeId);
    if (!sede) return res.status(404).json({ message: "Sede no existe" });

    const escenario = sede.escenarios.find((esc) => String(esc._id) === String(resolvedEscenarioId));
    if (!escenario || !escenario.activo) return res.status(400).json({ message: "Escenario inválido o inactivo" });

    const baseDate = new Date(fecha);
    const startTime = horaInicio || `${String(baseDate.getHours()).padStart(2, "0")}:${String(baseDate.getMinutes()).padStart(2, "0")}`;
    const startMins = parseTimeMinutes(startTime);
    const endMins = parseTimeMinutes(horaFin || minutesToHHmm(startMins + Number(horas || 1) * 60));

    if (startMins === null || endMins === null || startMins >= endMins) return res.status(400).json({ message: "Rango de horas inválido" });

    const formattedStartTime = minutesToHHmm(startMins);
    const formattedEndTime = minutesToHHmm(endMins);

    const reservaDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const now = new Date();
    const reservaDateTime = new Date(reservaDate.getFullYear(), reservaDate.getMonth(), reservaDate.getDate(), Math.floor(startMins / 60), startMins % 60);

    if (reservaDateTime < now) return res.status(400).json({ message: "No se puede reservar en el pasado" });

    // 2. Validación central de Concurrencia
    const reservaExistente = await Reserva.findOne({
      escenario: escenario._id,
      fecha: reservaDate,
      estadoPago: { $ne: "cancelada" },
      $or: [
        { horaInicio: { $lt: formattedEndTime }, horaFin: { $gt: formattedStartTime } }
      ]
    });

    if (reservaExistente) {
      return res.status(400).json({ message: "Este horario justo acaba de ser reservado o bloqueado por otra persona." });
    }

    const durationHours = (endMins - startMins) / 60;
    const total = escenario.precioPorHora * durationHours;

    // 3. Crear el Carrito Bloqueado
    const reserva = await Reserva.create({
      usuario: req.user._id,
      sede: sede._id,
      escenario: escenario._id,
      fecha: reservaDate,
      horaInicio: formattedStartTime,
      horaFin: formattedEndTime,
      total,
      estadoPago: "bloqueado" // TTL lo destruirá en 5 mins si no se actualiza
    });

    const response = await buildReservaDetails(reserva);
    res.json(response);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const cancelarReservaFisica = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });

    // Solo permitir borrar físicamente si está en estado bloqueado o cancelado
    if (reserva.estadoPago !== "bloqueado" && reserva.estadoPago !== "cancelada") {
      return res.status(400).json({ message: "No se puede borrar esta reserva." });
    }

    await reserva.deleteOne();
    res.json({ message: "Bloqueo liberado exitosamente" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const misReservas = async (req, res) => {
  const reservas = await Reserva.find({ usuario: req.user._id }).sort({ createdAt: -1 }).lean();

  const sedeIds = [...new Set(reservas.map((item) => String(item.sede)))];
  const sedes = await Sede.find({ _id: { $in: sedeIds } }).lean();
  const sedesMap = new Map(sedes.map((item) => [String(item._id), item]));

  const payload = reservas.map((reserva) => {
    const sede = sedesMap.get(String(reserva.sede));
    const escenario = sede?.escenarios?.find((item) => String(item._id) === String(reserva.escenario));
    return normalizeReservaOutput(reserva, sede, escenario);
  });

  res.json(payload);
};

export const reservasDeCancha = async (req, res) => {
  const r = await Reserva.find({ sede: req.params.sedeId }).populate("usuario");
  res.json(r);
};

export const actualizarEstado = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });

    // Verificar permisos: el usuario puede cancelar sus propias reservas o ser admin
    const isOwner = reserva.usuario.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN_CANCHA || req.user.role === ROLES.ADMIN_SISTEMA;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "No tienes permiso para modificar esta reserva" });
    }

    const estadoActual = reserva.paymentStatus === "canceled"
      ? "cancelada"
      : reserva.estadoPago === "pagado"
        ? "pagada"
        : "pendiente";

    // Si es el propietario, solo puede cancelar reservas pendientes
    if (isOwner && req.body.estado === 'cancelada' && estadoActual !== 'pendiente') {
      return res.status(400).json({ message: "Solo puedes cancelar reservas pendientes" });
    }

    if (req.body.estado === "cancelada") {
      reserva.paymentStatus = "canceled";
    }

    if (req.body.estadoPago === "pagado") {
      reserva.estadoPago = "pagado";
      reserva.paymentStatus = "succeeded";
    } else if (req.body.estadoPago === "pendiente") {
      reserva.estadoPago = "pendiente";
      reserva.paymentStatus = "pending";
    }

    await reserva.save();
    const r = await buildReservaDetails(reserva);
    res.json(r);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getReservaById = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });

    // Verificar que la reserva pertenezca al usuario autenticado o sea admin
    if (
      reserva.usuario.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.ADMIN_CANCHA &&
      req.user.role !== ROLES.ADMIN_SISTEMA
    ) {
      return res.status(403).json({ message: "No tienes permiso para ver esta reserva" });
    }

    const payload = await buildReservaDetails(reserva);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getHorariosOcupados = async (req, res) => {
  try {
    const { escenarioId } = req.params;
    const { fecha, ignorarBloqueoId } = req.query;

    if (!escenarioId || !fecha) {
      return res.status(400).json({ message: "Se requiere ID de escenario y la fecha" });
    }

    const reqDate = new Date(fecha);
    reqDate.setUTCHours(0, 0, 0, 0); // Omitimos posibles offsets que envíe el cliente
    // Imita exactamente cómo `crearReserva` almacena la fecha en base a Date() local:
    let [year, month, day] = fecha.split('-').map(Number);
    const queryDate = new Date(year, month - 1, day);

    // Armamos query base
    const query = {
      escenario: escenarioId,
      fecha: queryDate,
      estadoPago: { $ne: "cancelada" } // Reemplazado "estado" por estadoPago para acaparar: pendiente, pagado, bloqueado
    };

    // Si el frontend está pidiendo excluir el propio bloqueo temporal del usuario para no mostrárselo ocupado a él mismo
    if (ignorarBloqueoId) {
      query._id = { $ne: ignorarBloqueoId };
    }

    const reservasOcupadas = await Reserva.find(query)
      .select("horaInicio horaFin")
      .lean();

    const horarios = reservasOcupadas.map(r => ({
      horaInicio: r.horaInicio,
      horaFin: r.horaFin
    }));

    res.json(horarios);
  } catch (e) {
    console.error("[getHorariosOcupados] Error:", e);
    res.status(500).json({ message: e.message });
  }
};

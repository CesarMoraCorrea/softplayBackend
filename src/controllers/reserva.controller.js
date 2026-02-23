import Reserva from "../models/Reserva.js";
import Sede from "../models/Sede.js";

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
      precioHora: escenario.precioPorHora
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

export const crearReserva = async (req,res) => {
  try{
    const {
      sedeId,
      escenarioId,
      canchaId,
      fecha,
      horaInicio,
      horaFin,
      horas
    } = req.body;

    const resolvedEscenarioId = normalizeId(escenarioId) || normalizeId(canchaId);
    if (!resolvedEscenarioId) {
      return res.status(400).json({ message: "Debes enviar el escenario a reservar" });
    }

    const resolvedSedeId = normalizeId(sedeId);

    let sede = null;
    if (resolvedSedeId) {
      sede = await Sede.findById(resolvedSedeId);
      if (!sede) {
        sede = await Sede.findOne({ "escenarios._id": resolvedEscenarioId });
      }
    } else {
      sede = await Sede.findOne({ "escenarios._id": resolvedEscenarioId });
    }

    if(!sede) return res.status(404).json({ message: "Sede no existe" });

    let escenario = sede.escenarios.id(resolvedEscenarioId);
    if (!escenario) {
      const fallbackSede = await Sede.findOne({ "escenarios._id": resolvedEscenarioId });
      if (!fallbackSede) {
        return res.status(404).json({ message: "Escenario no existe en la sede" });
      }
      sede = fallbackSede;
      escenario = sede.escenarios.id(resolvedEscenarioId);
      if (!escenario) {
        return res.status(404).json({ message: "Escenario no existe en la sede" });
      }
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

    const durationHours = computeDurationHours(startTime, endTime);
    if (durationHours <= 0) {
      return res.status(400).json({ message: "El rango de horas no es válido" });
    }

    const reservaDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const total = (escenario.precioPorHora || 0) * durationHours;

    const reserva = await Reserva.create({
      usuario: req.user._id,
      sede: sede._id,
      escenario: escenario._id,
      fecha: reservaDate,
      horaInicio: startTime,
      horaFin: endTime,
      total,
      estadoPago: "pendiente"
    });

    const response = await buildReservaDetails(reserva);
    res.json(response);
  }catch(e){
    res.status(500).json({ message: e.message });
  }
};

export const misReservas = async (req,res) => {
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

export const reservasDeCancha = async (req,res) => {
  const r = await Reserva.find({ sede: req.params.sedeId }).populate("usuario");
  res.json(r);
};

export const actualizarEstado = async (req,res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
    
    // Verificar permisos: el usuario puede cancelar sus propias reservas o ser admin
    const isOwner = reserva.usuario.toString() === req.user._id.toString();
    const isAdmin = req.user.roles?.includes('admin_cancha') || req.user.roles?.includes('admin_sistema');
    
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
    }

    await reserva.save();
    const r = await buildReservaDetails(reserva);
    res.json(r);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getReservaById = async (req,res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
    
    // Verificar que la reserva pertenezca al usuario autenticado o sea admin
    if (reserva.usuario.toString() !== req.user._id.toString() && 
        !req.user.roles?.includes('admin_cancha') && 
        !req.user.roles?.includes('admin_sistema')) {
      return res.status(403).json({ message: "No tienes permiso para ver esta reserva" });
    }

    const payload = await buildReservaDetails(reserva);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

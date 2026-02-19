import Reserva from "../models/Reserva.js";
import Cancha from "../models/Cancha.js";

export const crearReserva = async (req,res) => {
  try{
    const { canchaId, fecha, horas } = req.body;
    const cancha = await Cancha.findById(canchaId);
    if(!cancha) return res.status(404).json({ message: "Cancha no existe" });
    const total = (cancha.precioHora || 0) * horas;
    const reserva = await Reserva.create({
      usuario: req.user._id, cancha: canchaId, fecha, horas, total
    });
    res.json(reserva);
  }catch(e){
    res.status(500).json({ message: e.message });
  }
};

export const misReservas = async (req,res) => {
  const r = await Reserva.find({ usuario: req.user._id }).populate("cancha");
  res.json(r);
};

export const reservasDeCancha = async (req,res) => {
  const r = await Reserva.find({ cancha: req.params.canchaId }).populate("usuario");
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
    
    // Si es el propietario, solo puede cancelar reservas pendientes
    if (isOwner && req.body.estado === 'cancelada' && reserva.estado !== 'pendiente') {
      return res.status(400).json({ message: "Solo puedes cancelar reservas pendientes" });
    }
    
    const r = await Reserva.findByIdAndUpdate(req.params.id, { estado: req.body.estado }, { new:true }).populate('cancha');
    res.json(r);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getReservaById = async (req,res) => {
  try {
    const reserva = await Reserva.findById(req.params.id).populate("cancha");
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
    
    // Verificar que la reserva pertenezca al usuario autenticado o sea admin
    if (reserva.usuario.toString() !== req.user._id.toString() && 
        !req.user.roles?.includes('admin_cancha') && 
        !req.user.roles?.includes('admin_sistema')) {
      return res.status(403).json({ message: "No tienes permiso para ver esta reserva" });
    }
    
    res.json(reserva);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

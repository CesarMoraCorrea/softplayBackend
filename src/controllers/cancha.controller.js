import Cancha from "../models/Cancha.js";

export const createCancha = async (req,res) => {
  try{
    const { nombre, descripcion, direccion, ubicacion, precioHora, imagenes, tipoCancha, servicios, horarios } = req.body;
    const cancha = await Cancha.create({
      nombre, descripcion, direccion,
      ubicacion, precioHora, imagenes,
      tipoCancha, servicios, horarios,
      propietario: req.user._id
    });
    res.json(cancha);
  }catch(e){
    res.status(500).json({ message: e.message });
  }
};

export const listCanchas = async (req,res) => {
  const { q } = req.query;
  const filter = q ? { nombre: { $regex: q, $options: "i" } } : {};
  const canchas = await Cancha.find(filter).limit(100).sort({ createdAt: -1 });
  res.json(canchas);
};

export const getCancha = async (req,res) => {
  const cancha = await Cancha.findById(req.params.id);
  if(!cancha) return res.status(404).json({ message: "No encontrada" });
  res.json(cancha);
};

export const updateCancha = async (req,res) => {
  const cancha = await Cancha.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if(!cancha) return res.status(404).json({ message: "No encontrada" });
  res.json(cancha);
};

export const deleteCancha = async (req,res) => {
  await Cancha.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
};

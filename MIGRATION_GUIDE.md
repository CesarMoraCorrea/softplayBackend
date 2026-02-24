# Migración de IDs de Escenarios

## Problema
Los escenarios en la base de datos **no tienen `_id`**, lo que causa errores al intentar crear reservas. Aunque el esquema Mongoose define `{ _id: true }`, los datos existentes fueron creados sin estos IDs.

## Solución
Se proporciona una migración que agrega automáticamente un `ObjectId` a cada escenario que no lo tenga.

## Pasos para ejecutar la migración

### 1. Posiciónate en la carpeta del backend
```bash
cd /home/cesar/Dev/SoftPlay/softplayBackend
```

### 2. Ejecuta la migración
```bash
npm run migrate:scenario-ids
```

Deberías ver una salida como:
```
✓ Conectado a MongoDB

Encontradas 3 sedes para revisar
  ✓ Agregado _id a escenario "Cancha Central" en sede "Cancha La Bombonera"
  ✓ Sede "Cancha La Bombonera" actualizada y guardada

✅ Migración completada:
   Sedes actualizadas: 1
   Total de sedes procesadas: 3
```

### 3. Verifica los cambios en MongoDB Compass
- Abre MongoDB Compass
- Navega a `softplay > sedes`
- Busca una sede y expande el array de `escenarios`
- Deberías ver que cada escenario ahora tiene un `_id`

## ¿Qué hace la migración?
- Busca todas las sedes en la BD
- Para cada escenario sin `_id`, le asigna un nuevo `ObjectId`
- Guarda los cambios en la BD

## ¿Qué pasa si ejecuto la migración dos veces?
No hay problema. La migración solo agrega `_id` a los escenarios que **no lo tienen**, por lo que es seguro ejecutarla múltiples veces.

## Después de la migración
Una vez completada, podrás:
1. Crear reservas sin errores
2. Ver los `escenarioId` correctamente en el listado de canchas
3. Acceder a detalles de reservas sin problemas

## Ventas Demo

Bienvenido al portal de análisis de ventas.

_Este dashboard utiliza datos ficticios de ventas de productos de consumo masivo en Perú._

**Strategio, by Vida Software**

---

# Resumen General

```ventas_por_anio
SELECT 
  EXTRACT(YEAR FROM fecha_venta) AS anio, 
  SUM(monto_venta) AS ventas_totales
FROM ventas_demo
GROUP BY anio
ORDER BY anio
```

<LineChart 
  data={ventas_por_anio} 
  x=anio 
  y=ventas_totales 
  xAxisTitle="Año" 
  yAxisTitle="Ventas Totales (PEN)"/>

---

# Ventas por Región

```ventas_por_region
SELECT 
  region, 
  SUM(monto_venta) AS ventas_totales
FROM ventas_demo
GROUP BY region
ORDER BY ventas_totales DESC
```

<BarChart 
  data={ventas_por_region} 
  x=region 
  y=ventas_totales 
  xAxisTitle="Región" 
  yAxisTitle="Ventas Totales (PEN)"/>

---

# Top 10 Productos

```top_productos
SELECT 
  producto, 
  SUM(monto_venta) AS ventas_totales
FROM ventas_demo
GROUP BY producto
ORDER BY ventas_totales DESC
LIMIT 10
```

<BarChart 
  data={top_productos} 
  x=producto 
  y=ventas_totales 
  xAxisTitle="Producto" 
  yAxisTitle="Ventas Totales (PEN)"
  horizontal/>

---

# Ventas Mensuales Recientes

```ventas_recientes
SELECT 
  EXTRACT(YEAR FROM fecha_venta) AS anio, 
  EXTRACT(MONTH FROM fecha_venta) AS mes, 
  SUM(monto_venta) AS ventas_totales
FROM ventas_demo
WHERE fecha_venta >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY anio, mes
ORDER BY anio, mes
```

<AreaChart
  data={ventas_recientes}
  x=mes
  y=ventas_totales
  series={anio}
  xAxisTitle="Mes"
  yAxisTitle="Ventas Totales (PEN)"/>

---

# Detalle de Ventas

```detalle_ventas
SELECT 
  fecha_venta, 
  region, 
  ciudad, 
  canal, 
  producto, 
  categoria, 
  cantidad, 
  monto_venta
FROM ventas_demo
ORDER BY fecha_venta DESC
LIMIT 100
```

<DataTable data={detalle_ventas} />

---

> Para más información sobre cómo usar este portal, contacta a tu administrador de sistema.

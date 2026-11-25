# Planillas de turnos

Web sencilla para generar el cuadrante mensual de técnicos con el ciclo **6-3**. Funciona en el navegador y no necesita instalar nada.

## Cómo se usa

1. Abre `index.html` en el navegador, o la dirección de GitHub Pages si está activada.
2. Pulsa **Importar Excel…** y elige tu cuadrante actual. La web importa el año completo del último mes del Excel. Con los dos últimos meses deduce:
   - en qué turno está cada persona (mañana, tarde o noche);
   - quién va en el 6-3 y en qué punto del ciclo está, y quién es fijo de lunes a viernes (y con qué turno: M2, T2, MT4, N2…);
   - los festivos (los días laborables en los que no trabajó el personal L-V);
   - la alternancia de guardias M / C.
3. A partir del mes siguiente, el cuadrante se genera solo. Muévete por los meses con las flechas.
4. En **Vacaciones y bajas** marca rangos de V, B, P o FI. Por defecto solo se marcan los días que a esa persona le tocaba trabajar. Las bajas no se cubren.
5. Pulsa cualquier casilla para cambiarla a mano. **Automático** la devuelve al patrón.
6. **Excel del mes** descarga el mes que estás viendo. **Excel por años…** descarga uno o varios años completos en un solo archivo, con una pestaña por mes.
7. **Imprimir** saca solo las personas, los días y las guardias, en una página A4 apaisada.
8. **Ver una persona:** en el Cuadrante, el desplegable «Ver» enseña solo a esa persona. Puedes verla en el mes o en el **año completo** (un mes por fila) e imprimirla para enviársela.
9. **Resumen anual:** días y horas trabajadas, horas de cómputo (como en el Excel), vacaciones gastadas y pendientes sobre un cupo (23 días por defecto, o uno propio por persona), bajas, permisos, faltas, días trabajados en fin de semana o festivo, y días y % en T4. Se puede descargar en Excel, y el **Excel por años** añade una pestaña de resumen delante de cada año. En naranja aparece quien se aleja más de 10 puntos de la media de su turno.
10. **Solapes de vacaciones:** en **Ajustes** se fija el máximo de personas de vacaciones a la vez por turno. Si al marcar vacaciones se supera, la web avisa antes de guardarlas, y la fila «Vacaciones M / T / N» del cuadrante sale en rojo ese día.

## Reglas que aplica

- **6-3:** cada persona rotativa trabaja 6 días y libra 3, sin cortes entre meses. El ciclo se guarda como «primer día libre», y se puede cambiar en **Personal**.
- **L-V:** trabaja de lunes a viernes, menos festivos, siempre con el mismo código. Su fila sale en azul claro.
- **Festivos:** el calendario oficial de 2027 de la Comunidad de Madrid ya viene cargado (Decreto 82/2026, BOCM 01/10/2026), junto con los locales de Madrid capital (San Isidro y la Almudena). Se pueden editar en **Ajustes**.
- **Terminales:** cada día van a la T4 3 personas de mañana (M4), 2 de tarde (T4) y 2 de noche (N4), y el resto a la T2. MT4 va aparte. Las cifras se cambian en **Ajustes**. Quien ya está en T4 sigue en T4 mientras dura su bloque. Para cubrir los huecos se elige a quien menos T4 ha hecho en las últimas 4 semanas, así el reparto queda equilibrado.
- **Guardias:** cambian cada semana, de lunes a domingo.
- **Totales:** HT son los días trabajados más las bajas, como en el Excel original. Horas = HT × 8.

## Datos y privacidad

Todo se guarda en el `localStorage` de tu navegador. No se envía nada a ningún servidor. Desde **Ajustes → Descargar copia de seguridad** puedes guardar un `.json` para pasarlo a otro ordenador o navegador.
El `.gitignore` impide subir `.xlsx` y `.json` al repositorio, porque llevan los nombres del personal.

## Archivos

- `index.html`, `css/styles.css`: la interfaz.
- `js/engine.js`: el motor del cuadrante (ciclo, terminales, guardias y totales).
- `js/importer.js`: lee el Excel.
- `js/exporter.js`: genera el `.xlsx`.
- `lib/exceljs.min.js`: [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (licencia MIT), incluida para que funcione sin internet.

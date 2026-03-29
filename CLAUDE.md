# Panel de Inicio Ángel

## Descripción del proyecto

Dashboard personal con gestión de tareas, hábitos, contactos y calendario de eventos.

---

## Layout general de la página

```
┌─────────────────────────────────────────────────────────────┐
│                        TAREAS (4 columnas)                   │
│  [ Todas ]  [ Esta semana ]  [ Hoy ]  [ Microtareas ]       │
├───────────────────────┬─────────────────────────────────────┤
│       HÁBITOS         │            CONTACTOS                 │
├───────────────────────┴─────────────────────────────────────┤
│                    CALENDARIO DE EVENTOS                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Secciones

### 1. TAREAS — fila superior, 4 columnas

#### Columna 1: Todas las tareas
- Lista completa de tareas pendientes.
- Fuente de verdad principal.

#### Columna 2: Esta semana
- Subconjunto de "Todas": tareas con fecha dentro de la semana actual (lunes–domingo).

#### Columna 3: Hoy
- Subconjunto de "Esta semana" y "Todas": tareas con fecha igual al día de hoy.

#### Columna 4: Microtareas
- Tareas pequeñas sin fecha asignada. No aparecen en las otras 3 columnas.
- Pueden promoverse a "Hoy": al hacerlo desaparecen de Microtareas y aparecen en Hoy (y por tanto en Esta semana y Todas).

**Regla de solapamiento:**
- Hoy ⊆ Esta semana ⊆ Todas
- Microtareas es un conjunto disjunto de las 3 primeras columnas.

---

### 2. HÁBITOS — columna izquierda (fila media)

- Todos los hábitos son diarios.
- Cada hábito se marca como completado / no completado cada día.
- Se muestra la racha activa (streak) de días consecutivos completados.

---

### 3. CONTACTOS — columna derecha (fila media)

Campos por contacto:
- **Nombre**
- **Notas libres**
- **Fecha de último contacto**
- **Asunto** del último contacto
- **Etiqueta** (categoría libre: amigo, trabajo, familia…)

---

### 4. CALENDARIO DE EVENTOS — fila inferior, ancho completo

- Lista de eventos ordenados de más próximo a más lejano.
- **Eventos pasados** (fecha anterior a hoy): se muestran tachados.
- **Eventos futuros**: se muestran con:
  - Fecha + días restantes
  - Nombre del evento
  - Lugar
  - Microtareas asociadas al evento

---

## Tecnologías

- **Stack**: HTML / CSS / JavaScript vanilla
- **Persistencia / Sincronización entre dispositivos**: Supabase (PostgreSQL, tiempo real, gratuito en tier básico)
- **Diseño**: Minimalista, moderno, tema claro

## Supabase

- **Project URL**: `https://rjyulnmjwkgiqekbwuzs.supabase.co`
- **Anon key**: `sb_publishable_HFAmCAD5mdLXuspPr2iZZg_sWooO0lu`

---

## Estado del proyecto

- [x] CLAUDE.md creado
- [ ] Estructura de archivos definida
- [ ] Maqueta / wireframe aprobada
- [ ] Implementación de Tareas (4 columnas)
- [ ] Implementación de Hábitos
- [ ] Implementación de Contactos
- [ ] Implementación de Calendario de Eventos
- [ ] Persistencia y sincronización (Supabase)
- [ ] Estilos y diseño final

---

## Decisiones pendientes

— Ninguna. Listo para implementar.

# Predicción de Ventas · Corporación Favorita

**Una página web que te dice cuánto va a vender cada tienda en los próximos 16 días.**

**Míralo en vivo:** https://juanacuna07.github.io/Prediccion-Ventas/

---

## ¿De qué trata?

Imagina una cadena de supermercados con 54 tiendas y 33 tipos de productos (bebidas, lácteos, carnes, limpieza…). Cada día necesita decidir **cuánto pedir** de cada cosa:

- Si pide de menos, se acaban los productos y pierde ventas.
- Si pide de más, los productos se dañan o vencen y pierde dinero.

Este proyecto usa **inteligencia artificial** para estimar las ventas de los próximos días a partir de lo que ya vendió antes, el calendario (días de pago, feriados), las promociones y otros datos como el precio del petróleo. Así, la empresa puede planear mejor su inventario.

Los datos son reales y públicos: provienen de la competencia
[Store Sales – Time Series Forecasting](https://www.kaggle.com/competitions/store-sales-time-series-forecasting) de Kaggle, con las ventas de Corporación Favorita (Ecuador).

## ¿Qué puedes hacer en la página?

| Sección | Qué encuentras |
|---|---|
| **Explorador de pronósticos** | Elige una tienda, un tipo de producto y unas fechas, y mira cuánto se espera vender. Puedes descargar el resultado en CSV. |
| **Comparación de modelos** | Seis métodos de predicción puestos a competir. Gana **LightGBM** ajustado con Optuna. |
| **Validación en el tiempo** | Prueba de que el modelo se comporta bien en cuatro periodos distintos, no solo en uno. |
| **¿Qué mira el modelo?** | Qué datos pesan más en cada predicción (las ventas recientes y el día de la semana son los más importantes). |
| **Metodología y descargas** | Cómo se construyó todo, y el informe técnico en PDF. |

## ¿Qué tan bien predice?

Se probó con datos que el modelo **no había visto** (15 al 30 de julio de 2017):

- **Error de 12,3 %** (métrica WAPE): en promedio, la predicción se desvía alrededor de un 12 % de las ventas reales.
- Es **casi el doble de preciso** que un método simple de promedios (22 % de error) y muy superior a repetir la semana anterior (63 %).
- El resultado se mantuvo estable en cuatro periodos consecutivos de 16 días.

## ¿Cómo lo uso en mi computador?

No necesitas instalar nada ni saber programar.

1. Descarga el proyecto: en GitHub pulsa **Code → Download ZIP**.
2. Descomprime el archivo (clic derecho → *Extraer todo*).
3. Entra a la carpeta y haz doble clic en **`index.html`**.

Se abre en tu navegador (Chrome, Edge, Firefox…) y funciona sin internet. Solo la tipografía necesita conexión; sin ella la página se ve igual con otra letra.

**Si prefieres abrirlo desde VS Code:** instala la extensión *Live Server*, haz clic derecho en `index.html` y elige **Open with Live Server**.

## ¿Cómo lo publico en internet (gratis)?

1. Crea una cuenta en [GitHub](https://github.com) y un repositorio **público**.
2. Sube los archivos del proyecto (**Add file → Upload files**), de modo que `index.html` quede en la raíz.
3. Entra a **Settings → Pages**, elige la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
4. En uno o dos minutos tu página estará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`.

## ¿Cómo actualizo los datos?

Si el equipo vuelve a ejecutar el notebook y obtiene resultados nuevos:

1. Reemplaza los archivos de la carpeta `notebook_outputs/`.
2. Ejecuta `python scripts/build_data.py` (necesita Python con `pandas` y `numpy`).
3. Sube los cambios a GitHub.

## ¿Qué contiene cada carpeta?

```
index.html           La página principal
css/                 Colores y diseño
js/                  El código que hace funcionar los gráficos y filtros
data/                Los datos ya listos para la página
notebook_outputs/    Resultados originales exportados del notebook de Colab
scripts/             Script que convierte los resultados en datos para la página
vendor/              Librería de gráficos (Chart.js) incluida para no depender de internet
assets/              Informe en PDF e imágenes
```

## Limitaciones a tener en cuenta

- La página muestra **pronósticos ya calculados**; no ejecuta el modelo en vivo.
- Familias como **Carnes, Pollo y Comidas preparadas** aparecen con pronósticos muy bajos en el archivo de resultados. Probablemente se debe a una regla del notebook para series sin actividad reciente y conviene revisarla antes de usar esas cifras en decisiones reales.
- El horizonte es de 16 días (16 al 31 de agosto de 2017) y los datos terminan en agosto de 2017.

## Tecnologías

Python y Google Colab (modelado) · LightGBM · Optuna · SHAP · HTML, CSS y JavaScript · Chart.js · GitHub Pages.

## Equipo

Juan Camilo Acuña Rojas · Luis Miguel Hernández
Programa de Ingeniería de Sistemas, Universidad de Ibagué (Colombia) · Curso de Sistemas Inteligentes.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AyudaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-rowell-gold hover:underline"
        >
          ← Volver al Dashboard
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-rowell-navy">
          Guia del Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Todo lo que necesitas saber para interpretar tu informe de cartera.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-rowell-navy">
          Indice
        </h2>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li><a href="#resumen" className="hover:text-rowell-gold">1. Resumen de Cartera</a></li>
          <li><a href="#rentabilidad" className="hover:text-rowell-gold">2. Rentabilidad: TWR vs MWR</a></li>
          <li><a href="#grafico-combinado" className="hover:text-rowell-gold">3. Grafico Combinado</a></li>
          <li><a href="#estrategias" className="hover:text-rowell-gold">4. Grafico por Estrategias</a></li>
          <li><a href="#distribucion" className="hover:text-rowell-gold">5. Distribucion de Activos</a></li>
          <li><a href="#posiciones" className="hover:text-rowell-gold">6. Posiciones y Operaciones</a></li>
          <li><a href="#filtros" className="hover:text-rowell-gold">7. Uso de Filtros</a></li>
          <li><a href="#glosario" className="hover:text-rowell-gold">8. Glosario de Terminos</a></li>
        </ul>
      </nav>

      {/* Sections */}
      <Section id="resumen" number="1" title="Resumen de Cartera">
        <P>
          La primera seccion muestra un resumen con los indicadores principales de tu cartera
          a fecha del ultimo corte disponible.
        </P>
        <Term term="Patrimonio total">
          Valor de mercado de todas tus inversiones mas el efectivo disponible en cuenta.
          Es el numero mas importante: refleja cuanto vale tu cartera hoy.
        </Term>
        <Term term="Patrimonio invertido">
          La parte de tu patrimonio que esta invertida en fondos, acciones u otros activos.
          No incluye el efectivo en cuenta.
        </Term>
        <Term term="Efectivo disponible">
          Dinero liquido en tu cuenta que no esta invertido. Puede usarse para nuevas
          inversiones o retiradas.
        </Term>
        <Term term="% Efectivo">
          Proporcion de tu patrimonio total que esta en efectivo. Un porcentaje alto
          significa que tienes mucha liquidez sin invertir.
        </Term>
        <Term term="Plusvalia latente">
          La diferencia entre el valor actual de tus inversiones y lo que pagaste por ellas
          (coste de adquisicion). Si es positiva, tus inversiones han ganado valor.
          Se llama &quot;latente&quot; porque no se ha materializado — no has vendido.
        </Term>
        <Term term="Plusvalia latente %">
          Lo mismo pero expresado en porcentaje sobre el coste. Por ejemplo, +5,2% significa
          que tus inversiones valen un 5,2% mas de lo que pagaste.
        </Term>
        <Term term="N° fondos">
          Numero total de posiciones (fondos, ETFs, acciones) en tu cartera.
        </Term>
        <Term term="N° ISINs">
          Numero de instrumentos financieros unicos. Un ISIN es un codigo internacional
          que identifica cada fondo o accion.
        </Term>
      </Section>

      <Section id="rentabilidad" number="2" title="Rentabilidad: TWR vs MWR">
        <P>
          Tu dashboard ofrece dos formas de medir la rentabilidad. Puedes alternar entre
          ambas con el selector TWR / MWR en la cabecera.
        </P>
        <Term term="TWR (Time Weighted Return)">
          Mide la rentabilidad de la cartera <strong>independientemente de las aportaciones
          o retiradas</strong> que hayas hecho. Es la metrica estandar de la industria para
          comparar gestores de fondos, porque elimina el efecto de tus decisiones de
          inversion/desinversion.
          <br /><br />
          <em>Ejemplo: si tu gestor obtiene un 8% TWR, significa que 100€ invertidos
          al inicio del periodo valdrian 108€ al final, sin importar si aportaste
          mas dinero durante el camino.</em>
        </Term>
        <Term term="MWR (Money Weighted Return)">
          Mide la rentabilidad <strong>ponderada por el capital realmente invertido</strong>
          en cada momento. Tiene en cuenta cuando aportaste o retiraste dinero.
          Refleja mejor <strong>tu</strong> experiencia real como inversor.
          <br /><br />
          <em>Ejemplo: si aportaste mucho dinero justo antes de una subida, tu MWR sera
          mayor que el TWR. Si aportaste antes de una bajada, sera menor.</em>
          <br /><br />
          Los traspasos internos entre cuentas no cuentan como aportacion ni retirada.
        </Term>
        <Term term="Periodos de rentabilidad">
          Se calculan para 5 periodos: <strong>1M</strong> (ultimo mes),
          <strong> 3M</strong> (3 meses), <strong>YTD</strong> (desde enero),
          <strong> 1A</strong> (12 meses) y <strong>ALL</strong> (desde el inicio).
        </Term>
        <Term term="Plusvalia total economica">
          Patrimonio actual menos las aportaciones netas. Indica cuanto has ganado (o perdido)
          en terminos absolutos, descontando el dinero que tu mismo pusiste.
        </Term>
      </Section>

      <Section id="grafico-combinado" number="3" title="Grafico Combinado">
        <P>
          El grafico principal combina tres metricas en una sola visualizacion.
          Puedes seleccionar 4 vistas diferentes.
        </P>
        <Term term="NAV (Net Asset Value)">
          El valor total de tu cartera cada mes. Se muestra como barras navy (azul oscuro).
          Cada barra representa el patrimonio al cierre de ese mes.
        </Term>
        <Term term="Rentabilidad %">
          La linea dorada muestra el porcentaje de rentabilidad mensual.
          Usa el eje derecho del grafico. Valores positivos indican que la cartera
          gano valor ese mes; negativos, que perdio.
        </Term>
        <Term term="Flujos de efectivo">
          Las barras azul claro muestran las aportaciones y reembolsos netos cada mes.
          Valores positivos = aportaste dinero. Negativos = retiraste dinero.
        </Term>
        <Term term="Vistas">
          <strong>General</strong>: muestra las tres metricas a la vez.<br />
          <strong>NAV</strong>: destaca solo el valor de la cartera.<br />
          <strong>Rentabilidad</strong>: destaca solo la rentabilidad mensual.<br />
          <strong>Aportaciones</strong>: destaca solo los flujos de efectivo.
        </Term>
        <Term term="KPIs del grafico">
          Encima del grafico se muestran: valor inicio y fin del periodo, variacion total,
          mejor y peor mes, rentabilidad acumulada y aportaciones netas.
        </Term>
      </Section>

      <Section id="estrategias" number="4" title="Grafico por Estrategias">
        <P>
          Si tienes mas de una cuenta (cartera), este grafico muestra como evoluciona
          cada una apilada sobre las demas.
        </P>
        <Term term="Stacked Area Chart">
          Cada area de color representa una de tus carteras. Las mas conservadoras
          aparecen en la base y las mas agresivas arriba. Esto te permite ver
          que proporcion de tu patrimonio corresponde a cada estrategia en cada momento.
        </Term>
        <Term term="Estrategias">
          <strong>Conservadora</strong>: carteras con riesgo bajo (renta fija, mixtos defensivos).<br />
          <strong>Moderada</strong>: riesgo medio (mixtos equilibrados).<br />
          <strong>Agresiva</strong>: riesgo alto (renta variable, mercados emergentes).
        </Term>
      </Section>

      <Section id="distribucion" number="5" title="Distribucion de Activos">
        <P>
          Dos graficos circulares (donut) que muestran como esta repartida tu cartera.
        </P>
        <Term term="Distribucion por Gestora">
          Muestra que porcentaje de tu cartera gestiona cada entidad (BlackRock, Amundi,
          Vanguard, etc.). Una alta concentracion en una sola gestora puede suponer
          mayor riesgo operativo.
        </Term>
        <Term term="Distribucion por Moneda">
          Muestra en que divisas estan denominadas tus inversiones (EUR, USD, GBP...).
          Inversiones en moneda extranjera conllevan riesgo de tipo de cambio.
        </Term>
        <Term term="Concentracion Top 5 / Top 10">
          Indica que porcentaje de tu cartera representan tus 5 o 10 posiciones mas grandes.
          Una concentracion alta (&gt;60% en Top 5) significa que dependes mucho de pocos activos.
        </Term>
      </Section>

      <Section id="posiciones" number="6" title="Posiciones y Operaciones">
        <Term term="Posiciones">
          Lista completa de todos los activos que tienes en cartera con su valor actual,
          coste, plusvalia y peso en la cartera.
        </Term>
        <Term term="ISIN">
          Codigo internacional de 12 caracteres que identifica un valor financiero
          de forma unica (ejemplo: LU0629459743).
        </Term>
        <Term term="Coste medio">
          Precio medio al que compraste cada participacion. Si compraste en varios momentos,
          es el promedio ponderado.
        </Term>
        <Term term="P&amp;L (Profit &amp; Loss)">
          Ganancia o perdida no realizada de cada posicion. Se calcula como:
          (precio actual - coste medio) × numero de participaciones.
        </Term>
        <Term term="% Cartera (Peso)">
          Que proporcion de tu cartera total representa esa posicion.
          Si un fondo tiene peso 25%, significa que una cuarta parte de tu patrimonio
          esta en ese fondo.
        </Term>
        <Term term="Operaciones">
          Historial de compras (suscripciones) y ventas (reembolsos) realizadas.
          Las operaciones en verde son compras, en rojo son ventas.
        </Term>
      </Section>

      <Section id="filtros" number="7" title="Uso de Filtros">
        <Term term="Filtro de fechas">
          Permite seleccionar un periodo concreto. Todos los graficos y KPIs
          se recalculan para el rango elegido. Deja ambos campos vacios para
          ver todo el historico.
        </Term>
        <Term term="Selector de cartera">
          Si tienes varias cuentas, puedes ver cada una por separado o
          &quot;Todas las carteras&quot; para la vision consolidada.
        </Term>
        <Term term="TWR / MWR">
          Alterna el metodo de calculo de rentabilidad. Ver seccion 2 para detalles.
        </Term>
      </Section>

      <Section id="glosario" number="8" title="Glosario Rapido">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GlossaryItem term="AUM" def="Assets Under Management — patrimonio total gestionado" />
          <GlossaryItem term="NAV" def="Net Asset Value — valor liquidativo de la cartera" />
          <GlossaryItem term="TWR" def="Time Weighted Return — rentabilidad ponderada por tiempo" />
          <GlossaryItem term="MWR" def="Money Weighted Return — rentabilidad ponderada por dinero" />
          <GlossaryItem term="YTD" def="Year To Date — desde el 1 de enero hasta hoy" />
          <GlossaryItem term="ISIN" def="International Securities Identification Number" />
          <GlossaryItem term="P&L" def="Profit & Loss — ganancia o perdida" />
          <GlossaryItem term="RV" def="Renta Variable — acciones, ETFs" />
          <GlossaryItem term="RF" def="Renta Fija — bonos, obligaciones" />
          <GlossaryItem term="FX" def="Foreign Exchange — tipo de cambio de divisas" />
          <GlossaryItem term="Suscripcion" def="Compra de participaciones de un fondo" />
          <GlossaryItem term="Reembolso" def="Venta de participaciones de un fondo" />
          <GlossaryItem term="Traspaso" def="Mover dinero entre fondos sin pasar por efectivo" />
          <GlossaryItem term="Snapshot" def="Foto de la cartera en una fecha concreta" />
        </div>
      </Section>

      {/* Footer */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          ¿Tienes dudas? Contacta con tu asesor en Rowell Patrimonios.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Ultima actualizacion: Abril 2026
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] opacity-90" />
        <h2 className="relative px-5 py-2.5 font-display text-base font-bold text-white sm:text-lg">
          {number}. {title}
        </h2>
      </div>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        {children}
      </div>
    </section>
  );
}

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[var(--color-gold)] pl-4">
      <p className="text-sm font-semibold text-[var(--color-primary)]">{term}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-gray-600">{children}</p>;
}

function GlossaryItem({ term, def }: { term: string; def: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-xs font-bold text-[var(--color-primary)]">{term}</span>
      <span className="ml-1.5 text-xs text-gray-500">— {def}</span>
    </div>
  );
}

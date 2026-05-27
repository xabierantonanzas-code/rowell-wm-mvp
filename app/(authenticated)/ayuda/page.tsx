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
          Explicacion de todos los campos, graficos y metricas que veras en tu cartera.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-rowell-navy">
          Indice
        </h2>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li><a href="#resumen" className="hover:text-rowell-gold">1. Resumen de Cartera</a></li>
          <li><a href="#evolucion" className="hover:text-rowell-gold">2. Evolucion Patrimonial</a></li>
          <li><a href="#distribucion" className="hover:text-rowell-gold">3. Distribucion de Activos</a></li>
          <li><a href="#xray" className="hover:text-rowell-gold">4. X-Ray de Cartera</a></li>
          <li><a href="#posiciones" className="hover:text-rowell-gold">5. Posiciones</a></li>
          <li><a href="#operaciones" className="hover:text-rowell-gold">6. Operaciones</a></li>
          <li><a href="#rentabilidad" className="hover:text-rowell-gold">7. Rentabilidad: TWR vs MWR</a></li>
          <li><a href="#filtros" className="hover:text-rowell-gold">8. Selectores y filtros</a></li>
          <li><a href="#glosario" className="hover:text-rowell-gold">9. Glosario rapido</a></li>
        </ul>
      </nav>

      {/* ================================================================== */}
      {/* 1. RESUMEN DE CARTERA                                              */}
      {/* ================================================================== */}
      <Section id="resumen" number="1" title="Resumen de Cartera">
        <P>
          El primer bloque del dashboard muestra los KPIs principales a fecha del ultimo
          snapshot disponible (la fecha aparece junto al campo &quot;N° Fondos&quot;).
        </P>

        <Term term="Patrimonio total">
          Valor de mercado de todas tus inversiones <strong>mas</strong> el efectivo
          disponible en cuenta. Es el numero que mejor refleja cuanto vale tu cartera hoy.
          Formula: <em>Valor Cartera + Efectivo Disponible</em>.
        </Term>
        <Term term="Valor cartera">
          Suma del valor de mercado de todas tus posiciones (fondos, acciones, ETFs).
          No incluye el efectivo. Indica cuanto valen tus inversiones hoy si se vendieran
          a precio de mercado.
        </Term>
        <Term term="Efectivo disponible">
          Dinero liquido en tu cuenta que <strong>no</strong> esta invertido. Puede usarse
          para nuevas inversiones, retiradas o queda a la espera de oportunidades.
        </Term>
        <Term term="% Efectivo">
          Proporcion del patrimonio total que esta en efectivo. Un % alto significa que
          tienes liquidez sin invertir. Es una decision estrategica: ni todo invertido
          ni todo en efectivo es lo ideal.
        </Term>
        <Term term="Patrimonio invertido">
          Lo que <strong>tu</strong> has aportado de bolsillo a la cartera, neto de
          retiradas. Se calcula sumando todas las aportaciones (PLUS) y restando todas
          las retiradas (MINUS) historicas. No es lo mismo que el Valor cartera: si tu
          cartera ha ganado un 20%, tu Valor cartera sera mayor que tu Patrimonio invertido.
        </Term>
        <Term term="Rentabilidad acumulada (€)">
          Diferencia entre el Valor cartera y el Patrimonio invertido. Indica cuanto has
          ganado (o perdido) en terminos absolutos descontando lo que tu mismo pusiste.
          En verde si has ganado, en rojo si has perdido.
        </Term>
        <Term term="Rentabilidad acumulada (%)">
          Lo mismo pero en porcentaje sobre el Patrimonio invertido. Por ejemplo,
          +24,29% significa que tu cartera vale un 24% mas de lo que aportaste.
        </Term>
        <Term term="Plusvalia total economica">
          Equivalente a la Rentabilidad acumulada en €. Termino contable: ganancia
          economica latente (no realizada porque no has vendido).
        </Term>
        <Term term="N° fondos">
          Numero total de posiciones (fondos, ETFs, acciones individuales) que tienes
          actualmente en cartera. Junto al numero aparece la fecha del ultimo snapshot.
        </Term>
        <Term term="N° ISINs">
          Numero de instrumentos financieros unicos. Un ISIN es un codigo internacional
          de 12 caracteres que identifica cada fondo o accion (ejemplo:
          <em> LU0629459743</em>). Si tienes el mismo fondo en dos cuentas, cuenta como
          un solo ISIN unico.
        </Term>
        <Term term="Concentracion Top 5 / Top 10">
          Proporcion de la cartera que esta en las 5 (o 10) posiciones mas grandes.
          Una concentracion alta (Top 5 &gt; 60%) significa que dependes mucho de pocos
          activos: si uno de ellos cae, tu cartera se ve muy afectada.
        </Term>
        <Term term="Costes acumulados">
          Suma de comisiones y retenciones que se te han cobrado en operaciones desde
          el origen de la cartera. Se desglosa en <strong>Com.</strong> (comisiones de
          gestion / suscripcion / reembolso) y <strong>Ret.</strong> (retenciones
          fiscales aplicadas en reembolsos de fondos).
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 2. EVOLUCION PATRIMONIAL                                           */}
      {/* ================================================================== */}
      <Section id="evolucion" number="2" title="Evolucion Patrimonial">
        <P>
          Grafico combinado que muestra como ha evolucionado tu patrimonio en el tiempo.
          Tres series de datos en una sola visualizacion.
        </P>
        <Term term="Barras apiladas de NAV">
          Cada barra es el valor de la cartera en una fecha de snapshot. Se apila en
          tres categorias: <strong>Efectivo</strong> (abajo, gris), <strong>Fondos
          (IIC)</strong> (medio, navy) y <strong>RV / Acciones</strong> (arriba, gold).
        </Term>
        <Term term="Linea de rentabilidad">
          Linea continua que muestra el porcentaje de rentabilidad acumulada en cada
          fecha de snapshot. Se mide en el eje derecho. La fecha y el valor cuadran
          siempre con la barra de NAV de la misma fecha.
        </Term>
        <Term term="Marcadores de aportaciones / reembolsos">
          Puntos sobre la linea continua de aportaciones netas:
          <br />
          • <strong>Verde</strong> = aportacion (PLUS): aportaste dinero a la cartera
          en esa fecha exacta.
          <br />
          • <strong>Rojo</strong> = retirada (MINUS): retiraste dinero.
          <br />
          Al pasar el raton aparece el detalle de la operacion.
        </Term>
        <Term term="Linea continua de aportaciones netas">
          Linea que muestra la <strong>suma acumulada</strong> de PLUS menos MINUS hasta
          ese momento. Entre aportaciones la linea se mantiene plana — no cae a cero.
        </Term>
        <Term term="Botones de rango">
          1M (ultimo mes), YTD (desde 1 enero), 1A (12 meses), Desde Origen (desde la
          primera operacion registrada en tu cartera).
        </Term>
        <Term term="Zoom temporal (+/-)">
          Cambia la granularidad del grafico: semanal, mensual, trimestral, anual.
          Los marcadores de aportaciones siempre se mantienen en su fecha exacta.
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 3. DISTRIBUCION DE ACTIVOS                                         */}
      {/* ================================================================== */}
      <Section id="distribucion" number="3" title="Distribucion de Activos">
        <P>
          Dos donuts que muestran como esta repartida tu cartera por tipo de activo y por
          divisa.
        </P>
        <Term term="Por Tipo de Activo">
          Reparte la cartera en tres categorias:
          <br />
          • <strong>Fondos (IIC)</strong>: fondos de inversion colectiva, sicavs, fondos
          indexados.
          <br />
          • <strong>Acciones / ETFs (RV)</strong>: posiciones directas en renta variable.
          <br />
          • <strong>Efectivo</strong>: dinero liquido en cuenta.
        </Term>
        <Term term="Por Moneda">
          Muestra en que divisas estan denominadas tus inversiones (EUR, USD, CHF, GBP...).
          Inversiones en moneda extranjera conllevan <strong>riesgo de tipo de cambio</strong>
          (FX): si el dolar baja contra el euro, tus posiciones USD valdran menos en
          euros aunque el activo no se mueva.
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 4. X-RAY                                                            */}
      {/* ================================================================== */}
      <Section id="xray" number="4" title="X-Ray de Cartera">
        <P>
          Analisis &quot;de rayos X&quot; (look-through) de tu cartera: <strong>desagrega
          los fondos en sus posiciones subyacentes</strong> para que puedas ver realmente
          en que sectores, regiones y empresas estas invertido a traves de tus fondos.
        </P>
        <P>
          <em>Por que es util:</em> si tienes un fondo &quot;Global Equity&quot;, el X-Ray
          te dice cuanto de ese fondo esta realmente en tecnologia, en EEUU, en Apple,
          etc. Asi puedes detectar concentraciones ocultas.
        </P>

        <Term term="Tabla de fondos (cabecera)">
          Lista de los fondos de tu cartera con su peso y metricas clave:
          <br />
          • <strong>Peso (%)</strong>: que porcentaje de tu patrimonio invertido representa
          el fondo.
          <br />
          • <strong>3 Anos Anualizado</strong>: rentabilidad anualizada del fondo a 3 anos
          (no de tu inversion, sino del fondo). Indica como ha rendido historicamente.
          <br />
          • <strong>Vol.</strong>: volatilidad anualizada a 3 anos. Mide cuanto fluctua el
          precio del fondo. Cuanto mas alta, mas riesgo / mas oscilaciones.
        </Term>

        <Term term="Distribucion de Activos (donut)">
          Composicion agregada de la cartera por clase de activo, ponderada por el peso
          de cada fondo. Tres columnas:
          <br />
          • <strong>Largo</strong>: exposicion neta a posiciones compradas.
          <br />
          • <strong>Corto</strong>: exposicion a posiciones vendidas en corto (poco
          comun en carteras retail).
          <br />
          • <strong>Patrimonio</strong>: Largo menos Corto. Es la exposicion neta real.
          <br />
          Categorias: Acciones, Obligaciones (bonos), Efectivo, Otro (oro, inmobiliario...).
        </Term>

        <Term term="Rango de vencimientos (Renta Fija)">
          Si tu cartera tiene bonos, se muestra el desglose por anos hasta el vencimiento
          de las obligaciones: 1-3 anos, 3-5, 5-7, 7-10, 10-15, 15-20, 20-30, mas de 30.
          Un perfil corto = bonos que vencen pronto, menos sensible a tipos. Largo = mas
          sensible a movimientos de tipos de interes. Si tu cartera es 100% RV este bloque
          no aparece.
        </Term>

        <Term term="Desglose por regiones">
          Reparte la exposicion accionaria (solo equities, no incluye bonos ni efectivo)
          por zonas geograficas. Tres grandes bloques:
          <br />
          • <strong>Europa / Oriente Medio / Africa</strong>: Reino Unido, Europa
          Occidental Euro / No Euro, Europa Emergente, Oriente Medio y Africa.
          <br />
          • <strong>America</strong>: Estados Unidos, Canada, America Latina y
          Centroamerica.
          <br />
          • <strong>Asia</strong>: Japon, Australasia, los 4 tigres (Hong Kong, Singapur,
          Corea del Sur, Taiwan) y Asia Emergente.
          <br />
          La barra apilada superior muestra los pesos relativos; las barras inferiores
          muestran cada sub-region.
        </Term>

        <Term term="Sectores de Renta Variable">
          Reparte la exposicion accionaria por sector economico. Tres super-sectores:
          <br />
          • <strong>Ciclico</strong> (amber): sectores que dependen del ciclo economico.
          Incluye Materiales Basicos, Consumo Ciclico (lujo, automocion), Servicios
          Financieros e Inmobiliario.
          <br />
          • <strong>Sensible al ciclo</strong> (azul): sectores con sensibilidad media.
          Servicios de Comunicacion, Energia, Industria, Tecnologia.
          <br />
          • <strong>Defensivo</strong> (verde): sectores resistentes a recesiones.
          Consumo Defensivo (alimentacion, higiene), Salud, Servicios Publicos
          (utilities).
        </Term>

        <Term term="Las 10 principales posiciones (look-through)">
          Las 10 empresas individuales con mayor peso en tu cartera <strong>combinando
          todos los fondos</strong>. Si Apple aparece en 3 fondos distintos, su peso
          total se suma. Por cada posicion:
          <br />
          • <strong>Activos %</strong>: peso en tu cartera total.
          <br />
          • <strong>Nombre</strong>: empresa.
          <br />
          • <strong>Tipo</strong>: Accion, Bono, ETF...
          <br />
          • <strong>Sector</strong>: sector economico.
          <br />
          • <strong>Pais</strong>: pais de la empresa.
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 5. POSICIONES                                                        */}
      {/* ================================================================== */}
      <Section id="posiciones" number="5" title="Posiciones">
        <P>
          Tabla con todas tus posiciones actuales separadas en dos sub-secciones:
          <strong> IIC</strong> (fondos de inversion) y <strong>RV</strong> (acciones/ETFs).
        </P>

        <Term term="ISIN">
          Codigo internacional de 12 caracteres que identifica un valor financiero de
          forma unica. Empieza por las dos letras del pais (ES = Espana, LU = Luxemburgo,
          IE = Irlanda, US = Estados Unidos...).
        </Term>
        <Term term="Producto">
          Nombre comercial del fondo o accion segun Mapfre.
        </Term>
        <Term term="Titulos / Participaciones">
          Cantidad de unidades que posees. Para acciones es el numero de acciones, para
          fondos el numero de participaciones.
        </Term>
        <Term term="Coste medio">
          Precio medio al que adquiriste cada unidad. Si compraste en varios momentos,
          es el promedio ponderado por cantidad. Aparece en la <strong>divisa original
          del activo</strong> (USD, CHF, EUR...) — el sufijo indica cual.
        </Term>
        <Term term="Precio mercado">
          Precio de mercado actual de cada unidad, en la divisa original del activo.
        </Term>
        <Term term="Divisa">
          Moneda en que cotiza el activo. EUR para europeos, USD para americanos, CHF
          para suizos, etc. Las posiciones en divisa distinta a EUR estan expuestas a
          tipo de cambio.
        </Term>
        <Term term="Posicion (EUR)">
          Valor de mercado de tu posicion en euros. Calculado como Titulos × Precio
          mercado × Tipo de cambio del momento. Es lo que valdria si la vendieras hoy.
        </Term>
        <Term term="P&L (Profit & Loss) en %">
          Rentabilidad <strong>en divisa base del activo</strong>: (Precio actual / Coste
          medio - 1). No incluye el efecto de la divisa. Si compraste Apple a 150 USD y
          ahora vale 200 USD, P&L = +33%, indistintamente de como se mueva el USD/EUR.
        </Term>
        <Term term="P&L con efecto divisa (€)">
          Rentabilidad en euros incluyendo el movimiento de tipo de cambio. Compara los
          euros que pagaste en el momento de compra con los euros que recibirias hoy si
          vendieras. Para posiciones USD, si el dolar se debilita contra el euro, este
          P&L sera menor que el P&L sin FX.
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 6. OPERACIONES                                                       */}
      {/* ================================================================== */}
      <Section id="operaciones" number="6" title="Operaciones">
        <P>
          Historial cronologico de todos los movimientos en tu cartera. Cada fila es una
          operacion con su fecha, tipo, producto, titulos e importe.
        </P>

        <Term term="Fecha">
          Fecha de contratacion de la operacion (cuando se ejecuto realmente, no la fecha
          de liquidacion).
        </Term>
        <Term term="Tipo de operacion">
          Las operaciones se clasifican en tres categorias internas que determinan si
          afectan a tu Patrimonio invertido:
          <br /><br />
          <strong>PLUS (aportas capital)</strong>:
          <br />
          • SUSCRIPCION FONDOS INVERSION — compras un fondo.
          <br />
          • COMPRA RV CONTADO — compras acciones o ETFs.
          <br />
          • COMPRA SICAVS — compras sicavs.
          <br />
          • RECEPCION INTERNA IIC LP — recibes fondos de un traspaso entrante.
          <br />
          • SUSC.TRASPASO EXT. — recibes fondos desde otra entidad.
          <br /><br />
          <strong>MINUS (retiras capital)</strong>:
          <br />
          • VENTA RV CONTADO — vendes acciones o ETFs.
          <br />
          • LIQUIDACION IICS — liquidas un fondo.
          <br />
          • TRASPASO INTERNO IIC LP — sales mediante traspaso interno.
          <br />
          • REEMBOLSO FONDO INVERSION — reembolsas un fondo.
          <br />
          • REEMBOLSO OBLIGATORIO IIC — reembolso forzoso (fondo cerrado, fusion).
          <br />
          • REEMBOLSO POR TRASPASO EXT. — sales hacia otra entidad.
          <br /><br />
          <strong>NEUTRO (no afecta al capital invertido)</strong>: fusiones, splits,
          contrasplits, switches entre clases del mismo fondo, traspasos internos puros,
          ajustes. Cambian la forma pero no el valor.
        </Term>
        <Term term="Producto">
          Nombre del fondo, accion o instrumento afectado por la operacion.
        </Term>
        <Term term="Titulos">
          Cantidad de participaciones o acciones movidas en la operacion.
        </Term>
        <Term term="Importe EUR">
          Valor en euros de la operacion. Para PLUS: el contravalor efectivo neto (lo que
          se carga en tu cuenta de efectivo). Para MINUS: el efectivo bruto multiplicado
          por el cambio de divisa (valor real que sale de la cartera, antes de comisiones
          y retenciones).
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 7. RENTABILIDAD: TWR VS MWR                                          */}
      {/* ================================================================== */}
      <Section id="rentabilidad" number="7" title="Rentabilidad: TWR vs MWR">
        <P>
          El dashboard ofrece dos formas de medir la rentabilidad. Puedes alternar
          entre ambas con el selector TWR / MWR (cuando este activo en la cabecera).
        </P>
        <Term term="TWR (Time Weighted Return)">
          Mide la rentabilidad de la cartera <strong>independientemente de las aportaciones
          o retiradas</strong>. Es la metrica estandar de la industria para comparar
          gestores de fondos, porque elimina el efecto de tus decisiones de
          inversion/desinversion.
          <br /><br />
          <em>Ejemplo: si tu cartera obtiene un 8% TWR, significa que 100€ invertidos
          al inicio del periodo valdrian 108€ al final, sin importar si aportaste mas
          dinero durante el camino.</em>
        </Term>
        <Term term="MWR (Money Weighted Return)">
          Mide la rentabilidad <strong>ponderada por el capital realmente invertido</strong>
          en cada momento. Tiene en cuenta cuando aportaste o retiraste. Refleja mejor
          <strong> tu</strong> experiencia real como inversor.
          <br /><br />
          <em>Ejemplo: si aportaste mucho justo antes de una subida, tu MWR sera mayor
          que el TWR. Si aportaste antes de una bajada, sera menor.</em>
        </Term>
        <Term term="Periodos de rentabilidad">
          Se calculan para 5 periodos: <strong>1M</strong> (ultimo mes),
          <strong> 3M</strong> (3 meses), <strong>YTD</strong> (desde 1 enero),
          <strong> 1A</strong> (12 meses) y <strong>ALL</strong> (desde el inicio).
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 8. FILTROS                                                          */}
      {/* ================================================================== */}
      <Section id="filtros" number="8" title="Selectores y filtros">
        <Term term="Filtro de fechas">
          Permite seleccionar un periodo concreto. Todos los graficos y KPIs se
          recalculan para el rango elegido. Botones rapidos: 1M, YTD, 1A, Desde Origen.
        </Term>
        <Term term="Selector de cartera (CV)">
          Si tienes varias cuentas de valores (CV), puedes ver cada una por separado
          o &quot;Todas&quot; para la vision consolidada.
        </Term>
        <Term term="Secciones colapsables">
          Cada bloque (1 a 7) se despliega con el icono de chevron a la derecha del
          titulo. Por defecto, al entrar al dashboard solo aparece desplegado el Resumen
          de Cartera.
        </Term>
      </Section>

      {/* ================================================================== */}
      {/* 9. GLOSARIO                                                         */}
      {/* ================================================================== */}
      <Section id="glosario" number="9" title="Glosario rapido">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GlossaryItem term="AUM" def="Assets Under Management — patrimonio total gestionado" />
          <GlossaryItem term="NAV" def="Net Asset Value — valor liquidativo" />
          <GlossaryItem term="TWR" def="Time Weighted Return" />
          <GlossaryItem term="MWR" def="Money Weighted Return" />
          <GlossaryItem term="YTD" def="Year To Date — desde 1 enero" />
          <GlossaryItem term="ISIN" def="International Securities Identification Number" />
          <GlossaryItem term="P&L" def="Profit & Loss — ganancia o perdida" />
          <GlossaryItem term="RV" def="Renta Variable — acciones, ETFs" />
          <GlossaryItem term="RF" def="Renta Fija — bonos, obligaciones" />
          <GlossaryItem term="IIC" def="Institucion de Inversion Colectiva — fondos, sicavs" />
          <GlossaryItem term="FX" def="Foreign Exchange — tipo de cambio" />
          <GlossaryItem term="CV" def="Cuenta de Valores" />
          <GlossaryItem term="CE" def="Cuenta de Efectivo" />
          <GlossaryItem term="Suscripcion" def="Compra de participaciones de un fondo" />
          <GlossaryItem term="Reembolso" def="Venta de participaciones de un fondo" />
          <GlossaryItem term="Traspaso" def="Mover dinero entre fondos sin pasar por efectivo" />
          <GlossaryItem term="Snapshot" def="Foto de la cartera en una fecha concreta" />
          <GlossaryItem term="Look-through" def="Desagregacion de un fondo en sus subyacentes" />
          <GlossaryItem term="Volatilidad" def="Medida estadistica de cuanto fluctua el precio" />
          <GlossaryItem term="Duracion" def="Sensibilidad de un bono a cambios de tipos" />
        </div>
      </Section>

      {/* Footer */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-gray-500">
          ¿Tienes dudas? Contacta con tu asesor en Rowell Patrimonios.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Ultima actualizacion: Mayo 2026
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

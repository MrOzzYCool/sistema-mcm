import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_TRAMITES    = "I.E.S. Privada Margarita Cabrera <tramites@margaritacabrera.edu.pe>";
const FROM_CONTABILIDAD = "I.E.S. Privada Margarita Cabrera <contabilidad@margaritacabrera.edu.pe>";

// alias para compatibilidad con código existente
const FROM = FROM_CONTABILIDAD;

// ─── Email de confirmación de recepción ───────────────────────────────────────

export async function enviarConfirmacionRecepcion(params: {
  email: string;
  nombres: string;
  apellidos: string;
  tipoTramite: string;
  token: string;
}): Promise<void> {
  const nombre = `${params.nombres} ${params.apellidos}`;

  await resend.emails.send({
    from: FROM_TRAMITES,
    to:   params.email,
    subject: "✅ Solicitud de trámite recibida — I.E.S. Privada Margarita Cabrera",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #a93526, #8a2b1f); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">I.E.S. Privada Margarita Cabrera</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Confirmación de solicitud de trámite</p>
        </div>

        <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin: 0 0 16px;">Hola <strong>${nombre}</strong>,</p>

          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Hemos recibido tu solicitud de trámite correctamente. Actualmente se encuentra en estado
            <strong style="color: #d97706;">PENDIENTE</strong> de revisión.
          </p>

          <div style="background: #f8f5f5; border-left: 4px solid #a93526; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
            <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Trámite solicitado</p>
            <p style="margin: 6px 0 0; font-size: 15px; color: #1e293b;">${params.tipoTramite}</p>
          </div>

          <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
            Te avisaremos por este medio cuando sea <strong>aprobada</strong> o si necesita alguna <strong>corrección</strong>.
            Por favor, mantén un ojo en tu bandeja de entrada (y en la carpeta de spam).
          </p>

          <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin: 0 0 24px;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">Código de seguimiento</p>
            <p style="margin: 4px 0 0; font-family: monospace; font-size: 13px; color: #475569; word-break: break-all;">${params.token}</p>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

          <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
            © 2026 I.E.S. Privada Margarita Cabrera · Este es un correo automático, no responder.
          </p>
        </div>
      </div>
    `,
  });
}

// ─── Email de rechazo con observaciones por campo ─────────────────────────────

export type ObservacionesCampos = {
  voucher?:     string;
  dni_anverso?: string;
  dni_reverso?: string;
};

export async function enviarCorreoRechazo(params: {
  email: string;
  nombres: string;
  apellidos: string;
  tipoTramite: string;
  token: string;
  observaciones: ObservacionesCampos;
  baseUrl: string;
}): Promise<void> {
  const nombre    = `${params.nombres} ${params.apellidos}`;
  const linkCorregir = `${params.baseUrl}/tramites-externos/subsanar/${params.token}`;

  const camposObservados = Object.entries(params.observaciones)
    .filter(([, v]) => v)
    .map(([campo, motivo]) => {
      const labels: Record<string, string> = {
        voucher:     "Voucher de pago",
        dni_anverso: "DNI — Anverso",
        dni_reverso: "DNI — Reverso",
      };
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b; width: 40%;">${labels[campo] ?? campo}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #dc2626;">${motivo}</td>
        </tr>`;
    }).join("");

  await resend.emails.send({
    from:    FROM_TRAMITES,
    to:      params.email,
    subject: "Solicitud observada - I.E.S. Privada Margarita Cabrera ⚠️",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #a93526, #8a2b1f); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">I.E.S. Privada Margarita Cabrera</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Tu solicitud necesita correcciones</p>
        </div>

        <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin: 0 0 16px;">Hola <strong>${nombre}</strong>,</p>

          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Hemos revisado tu solicitud de <strong>${params.tipoTramite}</strong> y encontramos
            observaciones en los siguientes documentos. Por favor, corrígelos para continuar con el proceso.
          </p>

          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; overflow: hidden; margin: 0 0 24px;">
            <div style="background: #ea580c; padding: 10px 16px;">
              <p style="margin: 0; color: #fff; font-weight: 600; font-size: 13px;">⚠️ Documentos que necesitan corrección</p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              ${camposObservados}
            </table>
          </div>

          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${linkCorregir}"
               style="display: inline-block; background: #a93526; color: #ffffff; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Corregir mi solicitud →
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
            O copia este enlace en tu navegador:
          </p>
          <p style="color: #64748b; font-size: 12px; word-break: break-all; margin: 0 0 24px;">
            ${linkCorregir}
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
            © 2026 I.E.S. Privada Margarita Cabrera · Este es un correo automático, no responder.
          </p>
        </div>
      </div>
    `,
  });
}

// ─── Email de aprobación con adjunto PDF ─────────────────────────────────────

export async function enviarCorreoAprobacion(params: {
  email:       string;
  nombres:     string;
  apellidos:   string;
  tipoTramite: string;
  pdfUrl:      string;
}): Promise<void> {
  const nombre        = `${params.nombres} ${params.apellidos}`;
  const nombreArchivo = `Comprobante_${params.nombres}_${params.apellidos}.pdf`.replace(/\s+/g, "_");

  // Intentar descargar el PDF para adjuntarlo
  let attachments: { filename: string; content: Buffer }[] = [];
  if (params.pdfUrl && params.pdfUrl !== "#") {
    try {
      const pdfRes = await fetch(params.pdfUrl);
      if (pdfRes.ok) {
        const arrayBuffer = await pdfRes.arrayBuffer();
        attachments = [{ filename: nombreArchivo, content: Buffer.from(arrayBuffer) }];
      }
    } catch (err) {
      console.error("[email] No se pudo adjuntar el PDF, se enviará solo el link:", err);
    }
  }

  await resend.emails.send({
    from:        FROM,
    to:          params.email,
    subject:     "Tu trámite ha sido aprobado - Instituto MCM ✅",
    attachments,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #a93526, #8a2b1f); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">I.E.S. Privada Margarita Cabrera</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">¡Tu solicitud fue aprobada!</p>
        </div>

        <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin: 0 0 16px;">Hola <strong>${nombre}</strong>,</p>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 0 0 24px; text-align: center;">
            <p style="margin: 0; font-size: 28px;">✅</p>
            <p style="margin: 8px 0 0; font-weight: 700; color: #15803d; font-size: 16px;">¡Solicitud aprobada con éxito!</p>
          </div>

          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Tu solicitud de <strong>${params.tipoTramite}</strong> ha sido aprobada.
            ${attachments.length > 0
              ? "Tu comprobante electrónico está adjunto a este correo."
              : "Puedes descargar tu comprobante electrónico en el siguiente enlace:"}
          </p>

          ${params.pdfUrl && params.pdfUrl !== "#" ? `
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${params.pdfUrl}"
               style="display: inline-block; background: #a93526; color: #ffffff; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
              📄 Descargar Comprobante
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">O copia este enlace:</p>
          <p style="color: #64748b; font-size: 12px; word-break: break-all; margin: 0 0 24px;">${params.pdfUrl}</p>
          ` : ""}

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
            © 2026 I.E.S. Privada Margarita Cabrera · Este es un correo automático, no responder.
          </p>
        </div>
      </div>
    `,
  });
}

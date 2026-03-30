import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Instituto MCM <contabilidad@margaritacabrera.edu.pe>";

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
    from: FROM,
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
